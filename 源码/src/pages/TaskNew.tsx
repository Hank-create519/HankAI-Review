import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewEngine } from '../sdk/react';
import { useTranslation } from 'react-i18next';

const TEMPLATES = [
  {
    key: 'general',
    systemPrompt: `【通用审查模式】
你将作为Hank个人工作室 AI审查系统，对用户提出的问题进行多维度全面审查。
审查维度包括但不限于：
- 逻辑一致性：检查推理链条是否完整、有无逻辑漏洞
- 事实准确性：核实关键事实和数据的可靠性
- 方案可行性：评估建议或方案的可执行性和风险
- 信息完整性：识别未提供但可能关键的信息缺口
请根据问题类型自动调整审查重点，确保分析客观、严谨、全面。`,
  },
  {
    key: 'code',
    systemPrompt: `【代码审查模式】
你将作为Hank个人工作室 AI审查系统，对用户提交的代码方案或技术设计进行专业审查。
审查维度：
- 架构设计：评估整体架构的合理性、可扩展性和解耦程度
- 技术选型：分析所选技术栈的适用性、成熟度和替代方案
- 性能优化：识别潜在性能瓶颈和优化方案
- 安全性：检查常见安全漏洞（注入、XSS、权限、敏感信息泄露等）
- 可维护性：代码结构清晰度、命名规范、注释质量
- 最佳实践：是否符合行业最佳实践和设计模式
请给出具体的问题定位和可操作的改进建议，标注严重程度。`,
  },
  {
    key: 'contract',
    systemPrompt: `【合同审查模式】
你将作为Hank个人工作室 AI审查系统，对用户提供的合同或协议条款进行审查分析。
审查维度：
- 条款完整性：检查合同是否包含必要条款（主体、标的、价款、履行、违约、争议解决等）
- 风险识别：标注对用户不利的条款、模糊表述、单方权利条款
- 权责平衡：分析双方权利义务是否对等，是否存在显失公平之处
- 合规性：检查是否符合相关法律法规的基本要求
- 履约风险：评估合同履行中可能出现的争议点和执行难点
- 缺失条款：指出通常应包含但合同未涉及的重要内容
请以保护用户利益为出发点进行分析，明确指出风险等级和建议修改方向。
重要提示：本审查为 AI 辅助分析，不构成法律意见，重大合同请咨询专业律师。`,
  },
  {
    key: 'thesis',
    systemPrompt: `【论文审查模式】
你将作为Hank个人工作室 AI审查系统，对用户提交的学术论文进行审查分析。
审查维度：
- 选题与创新性：评估研究问题的价值和创新点
- 文献综述：检查文献覆盖的全面性和时效性，分析研究缺口定位
- 方法论：评估研究方法的合理性、严谨性和可复现性
- 论证逻辑：检查从数据到结论的推理链条是否严密
- 数据分析：评估数据分析方法的正确性和解释的合理性
- 结构规范：检查论文格式（摘要、引言、方法、结果、讨论、结论）和引用规范
- 写作质量：语言表达清晰度、学术写作规范性
请逐章节分析，给出具体的修改建议和等级评定。
对方法论和数据部分的审查应特别严格，标注所有未经验证的假设。`,
  },
  {
    key: 'business',
    systemPrompt: `【商业计划审查模式】
你将作为Hank个人工作室 AI审查系统，对用户提交的商业计划进行审查分析。
审查维度：
- 市场需求：分析目标市场规模、增长趋势、用户痛点真实性
- 竞争格局：评估竞争态势、差异化空间和竞争壁垒
- 商业模式：审查盈利模式的可行性和可持续性
- 财务预测：分析收入/成本模型的合理性、盈亏平衡点和资金需求
- 团队能力：评估团队背景与项目需求的匹配度
- 执行路线：审查里程碑规划的合理性和资源匹配度
- 风险分析：识别市场风险、执行风险、资金风险、政策风险
请以投资人视角进行客观评估，明确指出关键假设和最大风险点。
对财务预测部分应特别审慎，标注所有未经市场验证的假设。`,
  },
];

export default function TaskNew() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { task, startReview, isRunning } = useReviewEngine();
  const [title, setTitle] = useState('');
  const [input, setInput] = useState('');
  const [template, setTemplate] = useState('general');
  const didSubmit = useRef(false);

  useEffect(() => {
    if (didSubmit.current && task && (task.status === 'preparing' || task.status === 'debating' || task.status === 'summarizing')) {
      nav('/monitor', { replace: true });
    }
  }, [task, nav]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !input.trim() || isRunning) return;
    const tpl = TEMPLATES.find(tp => tp.key === template);
    const fullInput = tpl
      ? `${tpl.systemPrompt}\n\n用户问题：\n${input}`
      : input;
    didSubmit.current = true;
    startReview(title.trim(), fullInput);
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 48, overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 580 }}>
        <form onSubmit={submit} className="anim-up">
          {/* Glass form card */}
          <div className="glass-dark" style={{ padding: '28px 32px' }}>
            {/* Title */}
            <div className="anim-up" style={{ marginBottom: 24, animationDelay: '0.04s' } as React.CSSProperties}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                {t('newReview.title')}
              </label>
              <input
                type="text" value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('newReview.titlePlaceholder')}
                disabled={isRunning}
                className="input"
                style={{ fontSize: 24, fontWeight: 600, padding: '12px 14px', letterSpacing: '-0.02em' }}
              />
            </div>

            {/* Template grid */}
            <div className="anim-up" style={{ marginBottom: 24, animationDelay: '0.08s' } as React.CSSProperties}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                {t('newReview.template')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {templateKeys.map((tk) => {
                  const selected = template === tk;
                  return (
                    <button
                      key={tk}
                      type="button"
                      onClick={() => setTemplate(tk)}
                      disabled={isRunning}
                      className={selected ? 'gradient-border' : ''}
                      style={{
                        position: 'relative',
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-lg)',
                        border: selected ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        background: selected ? 'rgba(79,108,247,0.06)' : 'transparent',
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        opacity: isRunning ? 0.5 : 1,
                        transition: 'transform 150ms var(--ease-out-expo), box-shadow 150ms var(--ease-out-expo)',
                      }}
                      onMouseEnter={e => {
                        if (!isRunning) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(79,108,247,0.08)'; }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{
                        position: 'relative',
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        letterSpacing: '-0.01em',
                        marginBottom: 4,
                      }}>
                        {t(`newReview.templates.${tk}`)}
                      </span>
                      <span style={{
                        position: 'relative',
                        fontSize: 10.5,
                        color: 'var(--text-tertiary)',
                        lineHeight: 1.4,
                        display: 'block',
                      }}>
                        {t(`newReview.templates.${tk}Desc`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input */}
            <div className="anim-up" style={{ marginBottom: 24, animationDelay: '0.12s' } as React.CSSProperties}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                {t('newReview.description')}
              </label>
              <textarea
                value={input} onChange={e => setInput(e.target.value)}
                placeholder={t('newReview.descriptionPlaceholder')}
                rows={6} disabled={isRunning}
                className="input textarea"
                style={{ fontSize: 13, padding: '12px 14px', lineHeight: 1.65 }}
              />
            </div>

            {/* Submit */}
            <div className="anim-up" style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4, animationDelay: '0.16s' } as React.CSSProperties}>
              <button
                type="submit" disabled={isRunning}
                style={isRunning ? {
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 24px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500,
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', border: 'none',
                  opacity: 0.5, cursor: 'not-allowed',
                } : {
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 28px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #4f6cf7, #8b5cf6)',
                  boxShadow: '0 4px 20px rgba(79,108,247,0.3)',
                  transition: 'transform 150ms var(--ease-out-expo), box-shadow 150ms var(--ease-out-expo)',
                }}
                onMouseEnter={e => {
                  if (!isRunning) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(79,108,247,0.45)'; }
                }}
                onMouseLeave={e => {
                  if (!isRunning) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,108,247,0.3)'; }
                }}
              >
                {isRunning ? t('newReview.running') : t('newReview.submit')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const templateKeys = ['general', 'code', 'contract', 'thesis', 'business'];
