insert into students (
  student_no,
  name,
  college,
  major,
  class_name,
  grade,
  political_status,
  party_stage,
  league_stage,
  ethnicity,
  advisor,
  student_status
) values (
  '2024001001',
  '李同学',
  '信息学院',
  '计算机科学与技术',
  '计科2401',
  '2024级',
  '共青团员',
  'activist',
  'member',
  '汉族',
  '王老师',
  '在读'
) on conflict (student_no) do nothing;

insert into users (openid, student_id, display_name, role, extra_permissions)
select 'mock-openid-u2024001', id, '李同学', 'class_leader', '[]'
from students
where student_no = '2024001001'
on conflict (openid) do nothing;

insert into knowledge_items (title, category, tags_text, keywords_text, answer, official_link, owner, status)
values
('奖学金评定常见问题', '奖助学金', '奖学金,评奖评优,成绩排名', '奖学金,评奖,评优,综测,综合测评,成绩排名', '奖学金评定以学院当年发布的评奖评优通知为准，通常综合考虑课程成绩、综合测评、处分记录、材料提交时间等因素。请先查看通知附件中的申报条件和时间安排。', 'https://example.edu.cn/scholarship', '学院团委', 'published'),
('休学、复学办理说明', '学籍事务', '休学,复学,学籍', '休学,复学,保留学籍,学籍异动', '休学、复学属于学籍异动事项，应按学校教务部门流程提交申请。小程序仅提供政策指引，具体审批以学校正式系统和学院通知为准。', 'https://example.edu.cn/student-status', '本科教务办公室', 'published'),
('查档调档与证明材料', '证明材料', '查档,调档,证明', '查档,调档,证明,政审,档案', '查档、调档和政审材料通常需要提前准备身份证明、单位函件或学院盖章申请。请在模板区下载对应材料清单，并按通知要求提交。', 'https://example.edu.cn/archive', '学生工作办公室', 'published'),
('宿舍调整申请说明', '校园生活', '宿舍,后勤', '宿舍,调宿,住宿,后勤', '宿舍调整需符合学校后勤部门的开放时间和申请条件。学院可协助核验学生身份，但最终安排以学校后勤平台结果为准。', 'https://example.edu.cn/dormitory', '后勤部门', 'published'),
('入党申请书提交后多久进入下一阶段', '党团事务', '入党,积极分子,提醒', '入党,申请书,积极分子,思想汇报,发展对象', '提交入党申请书后，党支部会结合谈话、培养考察和支部安排确定后续节点。积极分子、发展对象等阶段均需满足培养考察和材料要求。', 'https://example.edu.cn/party-process', '学院党委', 'published')
on conflict do nothing;

insert into templates (template_name, file_type, category, file_size_label, file_url, description, owner)
values
('在读证明申请模板', 'docx', '证明材料', '38KB', 'https://example.edu.cn/templates/student-proof.docx', '适用于普通在读证明、学籍证明等材料申请。', '学生工作办公室'),
('学院活动请假条模板', 'docx', '日常事务', '24KB', 'https://example.edu.cn/templates/leave-note.docx', '供学院活动、会议等场景使用，正式请假仍以学校系统为准。', '学生工作办公室'),
('学生活动预算表', 'xlsx', '学生组织', '42KB', 'https://example.edu.cn/templates/activity-budget.xlsx', '用于党团学活动经费预算、报销前置材料整理。', '学院团委'),
('活动简报模板', 'docx', '学生组织', '61KB', 'https://example.edu.cn/templates/news-brief.docx', '用于团日活动、志愿服务、专题学习等记录归档。', '学院团委')
on conflict do nothing;

insert into process_stages (process_type, stage_code, name, short_name, description, actions, reminder_days, sort_order)
values
('party', 'applicant', '入党申请人', '申请人', '提交入党申请书，接受党组织谈话和基础培养。', '["提交入党申请书","完成组织谈话","参加基础理论学习"]', 30, 1),
('party', 'activist', '入党积极分子', '积极分子', '完成培养联系人对接，按要求提交思想汇报和学习记录。', '["确定培养联系人","每季度提交思想汇报","参加集中培训"]', 90, 2),
('party', 'development', '发展对象', '发展对象', '接受政治审查、集中培训、公示等发展对象阶段工作。', '["完成政治审查","参加发展对象培训","完成支部公示"]', 60, 3),
('party', 'probationary', '预备党员', '预备', '进入预备期，按期参加组织生活并提交转正申请。', '["参加组织生活","提交季度思想汇报","预备期满提交转正申请"]', 365, 4),
('party', 'full', '正式党员', '正式', '完成转正流程，持续参加组织生活和党员教育。', '["参加组织生活","完成党员教育学习","参与支部服务"]', 180, 5),
('league', 'applicant', '入团申请人', '申请', '提交入团申请书，接受团支部教育培养。', '["提交入团申请书","参加团课学习"]', 30, 1),
('league', 'candidate', '团员发展对象', '发展', '完成团课、支部评议和材料审核。', '["完成团课","参加支部评议","提交发展材料"]', 60, 2),
('league', 'member', '共青团员', '团员', '完成入团流程，参与团组织生活和年度教育评议。', '["参加团日活动","完成智慧团建信息维护","参与年度教育评议"]', 180, 3)
on conflict (process_type, stage_code) do nothing;

insert into process_progress (student_id, process_type, current_stage_code, started_at, completed_actions, next_deadline, advisor)
select id, 'party', 'activist', date '2026-02-20', '["提交入党申请书","完成组织谈话","确定培养联系人"]', date '2026-05-20', '王老师'
from students where student_no = '2024001001'
on conflict (student_id, process_type) do nothing;

insert into process_progress (student_id, process_type, current_stage_code, started_at, completed_actions, next_deadline, advisor)
select id, 'league', 'member', date '2024-09-15', '["参加团日活动","完成智慧团建信息维护"]', date '2026-06-30', '计科2401团支书'
from students where student_no = '2024001001'
on conflict (student_id, process_type) do nothing;

insert into quiz_questions (question_code, category, difficulty, stem, options, answer_index, explanation, status, source)
values
('party_001', '党建基础', 'easy', '入党积极分子通常需要按要求提交哪类培养记录材料？', '["思想汇报","课程退选表","宿舍维修单","校园卡挂失单"]', 0, '思想汇报是培养考察中的常见材料之一，具体频次以党支部要求为准。', 'published', '学院党委'),
('party_002', '流程管理', 'easy', '党团流程中的关键节点提醒主要用于什么目的？', '["替代老师审批","提醒学生按时完成材料和学习要求","自动生成成绩单","开放所有敏感信息"]', 1, '提醒功能用于降低遗漏材料和错过节点的风险，不替代正式审批。', 'published', '学院党委'),
('privacy_001', '信息安全', 'easy', '涉及个人身份证号、手机号、生源地等敏感信息时，平台应如何处理？', '["公开展示给所有学生","仅按权限查看并避免在公开问答中展示","放在通知标题里","无需记录访问日志"]', 1, '敏感信息需要按权限控制，管理员操作也应留痕。', 'published', '学院党委'),
('process_001', '流程配置', 'easy', '入团或入党流程发生细微调整时，系统更适合如何维护？', '["删除所有历史记录","通过流程配置更新节点说明和提醒时间","让学生自行猜测","停用问答模块"]', 1, '流程配置化能支持后续微调，同时保留历史记录。', 'published', '学院党委')
on conflict (question_code) do nothing;
