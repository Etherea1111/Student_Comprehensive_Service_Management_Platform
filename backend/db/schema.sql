-- Kingbase/PostgreSQL-compatible schema for the Student Comprehensive Service Platform.
-- Sensitive fields are encrypted by the backend before persistence.

create table if not exists students (
  id bigserial primary key,
  student_no varchar(32) not null unique,
  name varchar(64) not null,
  college varchar(128) not null default '信息学院',
  major varchar(128) not null,
  class_name varchar(128) not null,
  grade varchar(32) not null,
  education_level varchar(32),
  political_status varchar(64),
  party_stage varchar(32) not null default 'none',
  league_stage varchar(32) not null default 'none',
  phone_encrypted text,
  id_card_encrypted text,
  birthplace_encrypted text,
  household_register_encrypted text,
  ethnicity varchar(64),
  advisor varchar(64),
  student_status varchar(32) not null default '在读',
  is_alumni boolean not null default false,
  awards text,
  remark text,
  updated_by bigint,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted_at timestamp
);

create table if not exists users (
  id bigserial primary key,
  openid varchar(128) unique,
  student_id bigint unique references students(id),
  display_name varchar(64),
  role varchar(32) not null default 'student',
  password_hash text,
  must_change_password boolean not null default true,
  extra_permissions jsonb not null default '[]',
  password_updated_at timestamp,
  last_login_at timestamp,
  disabled_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists idx_users_student_id on users(student_id);
create index if not exists idx_users_openid on users(openid);

create table if not exists password_reset_requests (
  id bigserial primary key,
  user_id bigint not null references users(id),
  reset_token varchar(128) not null unique,
  status varchar(32) not null default 'pending',
  expires_at timestamp not null,
  used_at timestamp,
  created_at timestamp not null default now()
);

create index if not exists idx_password_reset_user_status on password_reset_requests(user_id, status);

create table if not exists knowledge_items (
  id bigserial primary key,
  title varchar(256) not null,
  category varchar(64) not null,
  tags_text text,
  keywords_text text,
  answer text not null,
  official_link text,
  sensitive_hint text,
  owner varchar(128) not null,
  status varchar(32) not null default 'draft',
  created_by bigint references users(id),
  reviewed_by bigint references users(id),
  reviewed_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists idx_knowledge_status_category on knowledge_items(status, category);

create table if not exists templates (
  id bigserial primary key,
  template_name varchar(256) not null,
  category varchar(64) not null,
  file_type varchar(16) not null,
  file_size_label varchar(32),
  file_url text not null,
  description text,
  owner varchar(128) not null,
  status varchar(32) not null default 'published',
  created_by bigint references users(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists idx_templates_status_category on templates(status, category);

create table if not exists process_stages (
  id bigserial primary key,
  process_type varchar(32) not null,
  stage_code varchar(32) not null,
  name varchar(64) not null,
  short_name varchar(32),
  description text,
  actions jsonb not null default '[]',
  reminder_days int,
  sort_order int not null default 0,
  enabled boolean not null default true,
  updated_by bigint references users(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique(process_type, stage_code)
);

create table if not exists process_progress (
  id bigserial primary key,
  student_id bigint not null references students(id),
  process_type varchar(32) not null,
  current_stage_code varchar(32) not null,
  started_at date,
  completed_actions jsonb not null default '[]',
  next_deadline date,
  advisor varchar(64),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique(student_id, process_type)
);

create table if not exists quiz_questions (
  id bigserial primary key,
  question_code varchar(64) unique,
  category varchar(64) not null,
  difficulty varchar(32) not null default 'easy',
  stem text not null,
  options jsonb not null,
  answer_index int not null,
  explanation text,
  status varchar(32) not null default 'draft',
  source varchar(128),
  created_by bigint references users(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists idx_quiz_status_category on quiz_questions(status, category);

create table if not exists quiz_records (
  id bigserial primary key,
  user_id bigint not null references users(id),
  score int not null,
  total int not null,
  answers jsonb not null,
  created_at timestamp not null default now()
);

create table if not exists uploaded_files (
  id bigserial primary key,
  original_name varchar(256) not null,
  storage_path text not null,
  file_type varchar(16) not null,
  file_size bigint not null,
  owner_id bigint references users(id),
  visibility varchar(32) not null default 'private',
  created_at timestamp not null default now()
);

create table if not exists operation_logs (
  id bigserial primary key,
  operator_id bigint,
  operator_name varchar(64),
  operator_role varchar(32),
  action varchar(128) not null,
  target_type varchar(64),
  target_id varchar(64),
  before_value jsonb,
  after_value jsonb,
  ip_address varchar(64),
  device_info text,
  created_at timestamp not null default now()
);

create index if not exists idx_operation_logs_created_at on operation_logs(created_at desc);
