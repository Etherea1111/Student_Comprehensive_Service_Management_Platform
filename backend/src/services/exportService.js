const db = require('../db/pool')
const { rowsToCsv } = require('../utils/exportUtils')

async function exportStudents() {
  const result = await db.query(
    `
      select
        student_no as "studentNo",
        name,
        college,
        major,
        class_name as "className",
        grade,
        education_level as "educationLevel",
        political_status as "politicalStatus",
        party_stage as "partyStage",
        league_stage as "leagueStage",
        ethnicity,
        advisor,
        student_status as "studentStatus",
        case when is_alumni then '是' else '否' end as "isAlumni",
        awards,
        remark,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from students
      where deleted_at is null
      order by grade desc, class_name asc, student_no asc
    `
  )
  return rowsToCsv(
    [
      { label: 'student_no', key: 'studentNo' },
      { label: 'name', key: 'name' },
      { label: 'college', key: 'college' },
      { label: 'major', key: 'major' },
      { label: 'class_name', key: 'className' },
      { label: 'grade', key: 'grade' },
      { label: 'education_level', key: 'educationLevel' },
      { label: 'political_status', key: 'politicalStatus' },
      { label: 'party_stage', key: 'partyStage' },
      { label: 'league_stage', key: 'leagueStage' },
      { label: 'ethnicity', key: 'ethnicity' },
      { label: 'advisor', key: 'advisor' },
      { label: 'student_status', key: 'studentStatus' },
      { label: 'is_alumni', key: 'isAlumni' },
      { label: 'awards', key: 'awards' },
      { label: 'remark', key: 'remark' },
      { label: 'updated_at', key: 'updatedAt' }
    ],
    result.rows
  )
}

async function exportProcessProgress() {
  const result = await db.query(
    `
      select
        s.student_no as "studentNo",
        s.name,
        pp.process_type as "processType",
        pp.current_stage_code as "currentStageCode",
        to_char(pp.started_at, 'YYYY-MM-DD') as "startedAt",
        pp.completed_actions as "completedActions",
        to_char(pp.next_deadline, 'YYYY-MM-DD') as "nextDeadline",
        pp.advisor
      from process_progress pp
      join students s on s.id = pp.student_id
      where s.deleted_at is null
      order by pp.process_type asc, s.grade desc, s.class_name asc, s.student_no asc
    `
  )
  return rowsToCsv(
    [
      { label: 'student_no', key: 'studentNo' },
      { label: 'name', key: 'name' },
      { label: 'process_type', key: 'processType' },
      { label: 'current_stage_code', key: 'currentStageCode' },
      { label: 'started_at', key: 'startedAt' },
      { label: 'completed_actions', key: (row) => (row.completedActions || []).join('|') },
      { label: 'next_deadline', key: 'nextDeadline' },
      { label: 'advisor', key: 'advisor' }
    ],
    result.rows
  )
}

async function exportKnowledge() {
  const result = await db.query(
    `
      select
        title,
        category,
        tags_text as "tagsText",
        keywords_text as "keywordsText",
        answer,
        official_link as "officialLink",
        sensitive_hint as "sensitiveHint",
        owner,
        status,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from knowledge_items
      order by updated_at desc, id desc
    `
  )
  return rowsToCsv(
    [
      { label: 'title', key: 'title' },
      { label: 'category', key: 'category' },
      { label: 'tags', key: 'tagsText' },
      { label: 'keywords', key: 'keywordsText' },
      { label: 'answer', key: 'answer' },
      { label: 'official_link', key: 'officialLink' },
      { label: 'sensitive_hint', key: 'sensitiveHint' },
      { label: 'owner', key: 'owner' },
      { label: 'status', key: 'status' },
      { label: 'updated_at', key: 'updatedAt' }
    ],
    result.rows
  )
}

async function exportTemplates() {
  const result = await db.query(
    `
      select
        template_name as name,
        category,
        file_type as "fileType",
        file_size_label as size,
        file_url as url,
        description,
        owner,
        status,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from templates
      order by updated_at desc, id desc
    `
  )
  return rowsToCsv(
    [
      { label: 'name', key: 'name' },
      { label: 'category', key: 'category' },
      { label: 'file_type', key: 'fileType' },
      { label: 'size', key: 'size' },
      { label: 'url', key: 'url' },
      { label: 'description', key: 'description' },
      { label: 'owner', key: 'owner' },
      { label: 'status', key: 'status' },
      { label: 'updated_at', key: 'updatedAt' }
    ],
    result.rows
  )
}

async function exportApprovals() {
  const result = await db.query(
    `
      select
        ar.request_no as "requestNo",
        ar.request_type as "requestType",
        ar.title,
        ar.purpose,
        ar.status,
        ar.current_step as "currentStep",
        s.student_no as "studentNo",
        s.name as "studentName",
        to_char(ar.submitted_at, 'YYYY-MM-DD HH24:MI') as "submittedAt",
        to_char(ar.approved_at, 'YYYY-MM-DD HH24:MI') as "approvedAt",
        to_char(ar.rejected_at, 'YYYY-MM-DD HH24:MI') as "rejectedAt",
        ar.rejection_reason as "rejectionReason"
      from approval_requests ar
      left join students s on s.id = ar.student_id
      order by ar.updated_at desc, ar.id desc
    `
  )
  return rowsToCsv(
    [
      { label: 'request_no', key: 'requestNo' },
      { label: 'request_type', key: 'requestType' },
      { label: 'title', key: 'title' },
      { label: 'purpose', key: 'purpose' },
      { label: 'status', key: 'status' },
      { label: 'current_step', key: 'currentStep' },
      { label: 'student_no', key: 'studentNo' },
      { label: 'student_name', key: 'studentName' },
      { label: 'submitted_at', key: 'submittedAt' },
      { label: 'approved_at', key: 'approvedAt' },
      { label: 'rejected_at', key: 'rejectedAt' },
      { label: 'rejection_reason', key: 'rejectionReason' }
    ],
    result.rows
  )
}

async function exportWorkRecords() {
  const result = await db.query(
    `
      select
        record_type as "recordType",
        title,
        to_char(occurred_at, 'YYYY-MM-DD') as "occurredAt",
        organizer,
        location,
        participants_count as "participantsCount",
        student_nos as "studentNos",
        content,
        materials_summary as "materialsSummary",
        visibility,
        status,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from work_records
      order by occurred_at desc, updated_at desc, id desc
    `
  )
  return rowsToCsv(
    [
      { label: 'record_type', key: 'recordType' },
      { label: 'title', key: 'title' },
      { label: 'occurred_at', key: 'occurredAt' },
      { label: 'organizer', key: 'organizer' },
      { label: 'location', key: 'location' },
      { label: 'participants_count', key: 'participantsCount' },
      { label: 'student_nos', key: 'studentNos' },
      { label: 'content', key: 'content' },
      { label: 'materials_summary', key: 'materialsSummary' },
      { label: 'visibility', key: 'visibility' },
      { label: 'status', key: 'status' },
      { label: 'updated_at', key: 'updatedAt' }
    ],
    result.rows
  )
}

async function exportDeliveries() {
  const result = await db.query(
    `
      select
        a.title as "announcementTitle",
        ad.channel,
        ad.delivery_status as "deliveryStatus",
        ad.error_message as "errorMessage",
        u.account_name as "accountName",
        s.student_no as "studentNo",
        coalesce(s.name, u.display_name) as name,
        to_char(ad.delivered_at, 'YYYY-MM-DD HH24:MI') as "deliveredAt",
        to_char(ad.created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      from announcement_deliveries ad
      join announcements a on a.id = ad.announcement_id
      left join users u on u.id = ad.user_id
      left join students s on s.id = u.student_id
      order by ad.created_at desc, ad.id desc
    `
  )
  return rowsToCsv(
    [
      { label: 'announcement_title', key: 'announcementTitle' },
      { label: 'channel', key: 'channel' },
      { label: 'delivery_status', key: 'deliveryStatus' },
      { label: 'error_message', key: 'errorMessage' },
      { label: 'account_name', key: 'accountName' },
      { label: 'student_no', key: 'studentNo' },
      { label: 'name', key: 'name' },
      { label: 'delivered_at', key: 'deliveredAt' },
      { label: 'created_at', key: 'createdAt' }
    ],
    result.rows
  )
}

module.exports = {
  exportStudents,
  exportProcessProgress,
  exportKnowledge,
  exportTemplates,
  exportApprovals,
  exportWorkRecords,
  exportDeliveries
}
