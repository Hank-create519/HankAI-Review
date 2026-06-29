// Hank个人工作室 AI审查系统 1.0 · Electron 主进程
const { app, BrowserWindow, shell, ipcMain, safeStorage, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// ============ 数据库初始化 ============
let db = null;

async function initDB() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  db = new SQL.Database();

  // 加载已有数据
  const dbPath = path.join(app.getPath('userData'), 'hanhai.db');
  if (fs.existsSync(dbPath)) {
    try {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } catch {
      db = new SQL.Database();
    }
  }

  // 建表
  db.run(`
    CREATE TABLE IF NOT EXISTS configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_key TEXT UNIQUE NOT NULL,
      role_name TEXT NOT NULL,
      phase TEXT NOT NULL,
      provider TEXT NOT NULL,
      api_key TEXT DEFAULT '',
      base_url TEXT DEFAULT '',
      model_name TEXT DEFAULT '',
      temperature REAL DEFAULT 0.3,
      max_tokens INTEGER DEFAULT 4096,
      is_enabled INTEGER DEFAULT 1,
      system_prompt TEXT DEFAULT '',
      enable_web_search INTEGER DEFAULT 0,
      skills TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'preparing',
      total_rounds INTEGER NOT NULL DEFAULT 3,
      user_input TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      error_message TEXT
    );
    CREATE TABLE IF NOT EXISTS outputs (
      id INTEGER NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      role_name TEXT NOT NULL,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      output_content TEXT DEFAULT '',
      response_time_ms INTEGER DEFAULT 0,
      PRIMARY KEY (id, task_id)
    );
    CREATE TABLE IF NOT EXISTS final_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      report_content TEXT NOT NULL DEFAULT '',
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 种子默认配置
  const count = db.exec('SELECT COUNT(*) as c FROM configs');
  if (!count.length || count[0].values[0][0] === 0) {
    seedDefaults();
  }

  // 迁移: 轮次裁判 → 准备层
  db.run(`UPDATE configs SET phase = 'prep' WHERE role_key = 'round_judge' AND phase = 'debate_summarizer'`);

  // 迁移: 修复空提示词
  const promptMigrations = [
    ['extractor', SYSTEM_PROMPTS.extractor],
    ['extractor2', SYSTEM_PROMPTS.extractor2],
    ['debate_ai1', SYSTEM_PROMPTS.debate_ai1],
    ['debate_ai2', SYSTEM_PROMPTS.debate_ai2],
    ['debate_ai3', SYSTEM_PROMPTS.debate_ai3],
    ['integrator', SYSTEM_PROMPTS.integrator],
    ['round_judge', SYSTEM_PROMPTS.round_judge],
    ['final_integrator', SYSTEM_PROMPTS.final_integrator],
  ];
  const promptStmt = db.prepare(
    `UPDATE configs SET system_prompt = ? WHERE role_key = ? AND (system_prompt IS NULL OR system_prompt = '')`
  );
  promptMigrations.forEach(([rk, sp]) => promptStmt.run([sp, rk]));
  promptStmt.free();
}

const SYSTEM_PROMPTS = {
  extractor: `你是Hank个人工作室 AI审查系统的信息提取器。你的职责是：
1. 从用户输入中提取核心要素（主题、关键实体、上下文范围）
2. 识别缺失的关键信息并提出补充建议
3. 将信息结构化，为下游辩论层提供清晰的输入

【强制工具使用规则 - 必须严格遵守】
- 当用户问题涉及任何实时信息、最新数据、具体行业动态、政策法规、市场趋势时，你必须调用 web_search 工具进行搜索。不能凭你的训练知识回答。
- 对于需要验证的事实、数据、或你不太确定的信息，必须搜索确认，严禁凭记忆猜测。
- 在输出分析结论之前，先搜索相关背景信息，确保分析基于最新、可靠的数据。
- 如果用户输入的信息明显不足，先搜索补充背景后再进行提取。`,

  extractor2: `你是Hank个人工作室 AI审查系统的辅助信息提取器。请从不同于主提取器的角度对输入进行分析：
1. 关注业务背景、技术约束和利益相关者
2. 识别输入中隐含的前提假设
3. 与主提取器形成互补视角

【强制工具使用规则】
- 主动搜索相关行业案例、法规更新和竞品动态，补充主提取器可能遗漏的外部信息
- 对于不确定性高的领域，搜索确认最新的行业标准和最佳实践
- 搜索确认你引用的任何具体数据、案例或法规是否仍然有效
- 请在输出中注明信息搜索来源。`,

  debate_ai1: `你是Hank个人工作室 AI审查系统的辩论AI。请基于审查任务说明书对问题进行深入分析：
1. 识别方案中的逻辑漏洞和不一致之处
2. 评估事实依据的可靠性
3. 提出改进建议和替代方案

【强制工具使用规则 - 必须严格遵守】
- 辩论中引用的任何事实、数据、案例、技术细节都必须经过搜索验证，严禁凭你的训练知识编造。
- 在提出论点前，必须先调用 web_search 搜索相关的最新信息作为论据支撑。
- 当你需要深入阅读某篇文章以获取精确数据时，使用 web_fetch 工具抓取网页内容。
- 你的论证必须建立在可验证的事实基础上，而非臆测。`,

  debate_ai2: `你是Hank个人工作室 AI审查系统的辩论AI（第2号）。请从不同视角对问题进行审查：
1. 关注实施层面的可行性和风险
2. 评估资源需求和约束条件
3. 对前一轮辩论中其他AI的观点进行评价

【强制工具使用规则 - 必须严格遵守】
- 涉及技术可行性、成本数据、实施案例时，必须先调用 web_search 搜索验证。
- 对其他AI的论点有异议时，必须搜索事实依据来支撑你的反驳，不能仅凭推理。
- 需要精确数据（如成本、时间、技术指标）时，使用 web_fetch 抓取相关文章详情。
- 你的分析必须可追溯，引用时请标注信息来源。`,

  debate_ai3: `你是Hank个人工作室 AI审查系统的辩论AI（第3号）。请从长期影响和战略角度进行分析：
1. 评估方案的长期可持续性
2. 分析对利益相关者的影响
3. 提出前瞻性建议

【强制工具使用规则 - 必须严格遵守】
- 行业趋势、政策走向、前沿研究成果等分析必须基于搜索获取的最新信息。
- 在做出前瞻性判断前，必须先调用 web_search 了解当前行业格局和发展方向。
- 需要参考具体研究报告或专业文章时，使用 web_fetch 抓取网页内容深入阅读。
- 你的战略建议必须有可查证的行业趋势或案例支撑。`,

  integrator: `你是Hank个人工作室 AI审查系统的辩论汇总员。请对当前轮次的辩论情况进行汇总：
1. 识别审查AI之间的共识点和分歧点
2. 评估辩论质量（是否充分展开、是否有盲区）
3. 判断是否需要进行下一轮辩论

工具使用指引：
- 当汇总时需要核实各方引用的背景事实或补充最新数据以做出更准确判断时，使用 web_search 工具联网搜索
- 请以中性、客观的态度进行汇总。`,

  round_judge: `你是Hank个人工作室 AI审查系统的轮次裁判。你的职责是在信息提取阶段完成后，基于提取器对用户输入的结构化分析，评估审查内容的复杂度，判定需要几轮辩论。

判定标准：
- 简单问题（观点明确、维度单一）：1-2轮
- 一般问题（有一定复杂度、涉及2-3个维度）：2-3轮
- 复杂问题（多维度交叉、需要深入辩论）：3-4轮
- 高度复杂问题（涉及多方利益、战略决策）：4-5轮

请在分析后明确输出轮数判定，格式为："经评估，需要X轮辩论"，并简要说明判定理由。`,

  final_integrator: `你是Hank个人工作室 AI审查系统的最终报告生成员。请基于所有对话记录生成最终审查报告：
1. 综合所有AI的审查意见
2. 汇总关键发现和建议
3. 给出明确的结论和行动建议

工具使用指引：
- 当生成报告时需要补充最新行业数据、核实关键事实或引用权威来源以增强报告可信度时，使用 web_search 工具联网搜索
- 请以正式报告格式输出，结构清晰、逻辑连贯。`,
};

function seedDefaults() {
  const defaults = [
    ['extractor','信息提取器','prep','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.1,4096,1,SYSTEM_PROMPTS.extractor,0,JSON.stringify(['web_search'])],
    ['extractor2','辅助提取器','prep','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.2,4096,1,SYSTEM_PROMPTS.extractor2,0,JSON.stringify(['web_search'])],
    ['debate_ai1','审查AI-1','debate','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.3,4096,1,SYSTEM_PROMPTS.debate_ai1,0,JSON.stringify(['web_search','web_fetch'])],
    ['debate_ai2','审查AI-2','debate','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.4,4096,1,SYSTEM_PROMPTS.debate_ai2,0,JSON.stringify(['web_search','web_fetch'])],
    ['debate_ai3','审查AI-3','debate','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.35,4096,1,SYSTEM_PROMPTS.debate_ai3,0,JSON.stringify(['web_search','web_fetch'])],
    ['integrator','辩论汇总员','debate_summarizer','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.1,4096,1,SYSTEM_PROMPTS.integrator,0,JSON.stringify(['web_search'])],
    ['round_judge','轮次裁判','prep','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.1,2048,1,SYSTEM_PROMPTS.round_judge,0,'[]'],
    ['final_integrator','最终报告员','summary','deepseek','','https://api.deepseek.com/v1/chat/completions','deepseek-chat',0.2,8192,1,SYSTEM_PROMPTS.final_integrator,0,JSON.stringify(['web_search'])],
  ];
  const stmt = db.prepare('INSERT INTO configs (role_key,role_name,phase,provider,api_key,base_url,model_name,temperature,max_tokens,is_enabled,system_prompt,enable_web_search,skills) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  defaults.forEach(d => stmt.run(d));
  stmt.free();
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(app.getPath('userData'), 'hanhai.db');
  fs.writeFileSync(dbPath, buffer);
}

// ============ 数据库 IPC ============
ipcMain.handle('db:get-configs', () => {
  const r = db.exec('SELECT * FROM configs ORDER BY id');
  if (!r.length) return [];
  return r[0].values.map(row => ({
    id: row[0], roleKey: row[1], roleName: row[2], phase: row[3], provider: row[4],
    apiKey: row[5], baseUrl: row[6], modelName: row[7], temperature: row[8],
    maxTokens: row[9], isEnabled: row[10] === 1, systemPrompt: row[11],
    enableWebSearch: row[12] === 1, skills: JSON.parse(row[13] || '[]'),
  }));
});

ipcMain.handle('db:update-config', (_e, roleKey, patch) => {
  const fields = [], vals = [];
  if (patch.provider !== undefined) { fields.push('provider=?'); vals.push(patch.provider); }
  if (patch.apiKey !== undefined) { fields.push('api_key=?'); vals.push(patch.apiKey); }
  if (patch.baseUrl !== undefined) { fields.push('base_url=?'); vals.push(patch.baseUrl); }
  if (patch.modelName !== undefined) { fields.push('model_name=?'); vals.push(patch.modelName); }
  if (patch.temperature !== undefined) { fields.push('temperature=?'); vals.push(patch.temperature); }
  if (patch.maxTokens !== undefined) { fields.push('max_tokens=?'); vals.push(patch.maxTokens); }
  if (patch.isEnabled !== undefined) { fields.push('is_enabled=?'); vals.push(patch.isEnabled ? 1 : 0); }
  if (patch.systemPrompt !== undefined) { fields.push('system_prompt=?'); vals.push(patch.systemPrompt); }
  if (patch.enableWebSearch !== undefined) { fields.push('enable_web_search=?'); vals.push(patch.enableWebSearch ? 1 : 0); }
  if (patch.skills !== undefined) { fields.push('skills=?'); vals.push(JSON.stringify(patch.skills)); }
  if (!fields.length) return;
  vals.push(roleKey);
  db.run(`UPDATE configs SET ${fields.join(',')} WHERE role_key=?`, vals);
  saveDB();
});

ipcMain.handle('db:get-tasks', () => {
  const r = db.exec('SELECT * FROM tasks ORDER BY created_at DESC');
  if (!r.length) return [];
  return r[0].values.map(row => ({
    id: String(row[0]), title: row[1], status: row[2], totalRounds: row[3],
    createdAt: row[5], completedAt: row[6], errorMessage: row[7],
  }));
});

ipcMain.handle('db:save-task', (_e, task) => {
  db.run('INSERT OR REPLACE INTO tasks (id,title,status,total_rounds,user_input,created_at,completed_at,error_message) VALUES (?,?,?,?,?,?,?,?)',
    [task.id, task.title, task.status, task.totalRounds, task.userInput || '', task.createdAt, task.completedAt || null, task.errorMessage || null]);
  saveDB();
});

ipcMain.handle('db:update-task', (_e, id, status, errorMessage) => {
  db.run('UPDATE tasks SET status=?, error_message=? WHERE id=?', [status, errorMessage || null, id]);
  if (status === 'completed') db.run("UPDATE tasks SET completed_at=datetime('now') WHERE id=?", [id]);
  saveDB();
});

ipcMain.handle('db:delete-task', (_e, id) => {
  db.run('DELETE FROM tasks WHERE id=?', [id]);
  saveDB();
});

ipcMain.handle('db:save-outputs', (_e, outputs) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO outputs (id,task_id,round_number,role_name,role_key,status,output_content,response_time_ms) VALUES (?,?,?,?,?,?,?,?)');
  outputs.forEach(o => stmt.run([o.id, o.taskId, o.roundNumber, o.roleName, o.roleKey, o.status, o.outputContent, o.responseTimeMs]));
  stmt.free();
  saveDB();
});

ipcMain.handle('db:get-outputs', (_e, taskId) => {
  const stmt = db.prepare('SELECT * FROM outputs WHERE task_id=? ORDER BY id');
  stmt.bind([taskId]);
  const results = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    results.push({ id: r.id, roundNumber: r.round_number, roleName: r.role_name, roleKey: r.role_key, status: r.status, outputContent: r.output_content, responseTimeMs: r.response_time_ms });
  }
  stmt.free();
  return results;
});

ipcMain.handle('db:save-report', (_e, report) => {
  db.run('INSERT OR REPLACE INTO final_reports (task_id,report_content,generated_at) VALUES (?,?,?)',
    [report.taskId, report.reportContent, report.generatedAt]);
  saveDB();
});

ipcMain.handle('db:get-report', (_e, taskId) => {
  const stmt = db.prepare('SELECT * FROM final_reports WHERE task_id=?');
  stmt.bind([taskId]);
  if (stmt.step()) {
    const r = stmt.getAsObject();
    stmt.free();
    return { taskId: String(r.task_id), reportContent: String(r.report_content), generatedAt: String(r.generated_at) };
  }
  stmt.free();
  return null;
});

// 安全 Key 存储路径
const secureKeysPath = path.join(app.getPath('userData'), 'secure-keys.json');

function loadSecureKeys() {
  try {
    if (fs.existsSync(secureKeysPath)) {
      return JSON.parse(fs.readFileSync(secureKeysPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveSecureKeys(keys) {
  // Ensure userData directory exists
  const dir = path.dirname(secureKeysPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(secureKeysPath, JSON.stringify(keys, null, 2), 'utf-8');
}

// ============ IPC 安全存储 ============
ipcMain.handle('secure:set-key', (_event, roleKey, apiKey) => {
  if (!apiKey) return false;
  try {
    const encrypted = safeStorage.encryptString(apiKey);
    const keys = loadSecureKeys();
    keys[roleKey] = encrypted.toString('base64');
    saveSecureKeys(keys);
    return true;
  } catch (err) {
    console.error('secure:set-key error:', err);
    return false;
  }
});

ipcMain.handle('secure:get-key', (_event, roleKey) => {
  try {
    const keys = loadSecureKeys();
    const b64 = keys[roleKey];
    if (!b64) return null;
    const buf = Buffer.from(b64, 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.error('secure:get-key error:', err);
    return null;
  }
});

ipcMain.handle('secure:delete-key', (_event, roleKey) => {
  try {
    const keys = loadSecureKeys();
    delete keys[roleKey];
    saveSecureKeys(keys);
    return true;
  } catch (err) {
    console.error('secure:delete-key error:', err);
    return false;
  }
});

// ============ 剪贴板 IPC ============
ipcMain.handle('clipboard:readText', () => clipboard.readText());

// ============ 自定义菜单（确保 file:// 下 Edit > Paste 可用） ============
function setupMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let mainWindow = null;

function createWindow() {
  const isDev = false; // !app.isPackaged

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    title: 'Hank个人工作室 AI审查系统',
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const url = isDev
    ? 'http://localhost:5188'
    : `file://${path.join(__dirname, 'index.html')}`;

  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await initDB();
  createWindow();
  setupMenu();
});

app.on('window-all-closed', () => {
  saveDB();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  saveDB();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
