const fs = require('fs')
const path = require('path')
const db = require('../db/pool')
const { badRequest, forbidden, notFound } = require('../utils/errors')
const { decryptField, maskIdCard } = require('../utils/cryptoField')
const { isSafeStoredPath } = require('../utils/fileStorage')

const allowedTypes = ['proof', 'seal']
const allowedStatuses = ['draft', 'pending', 'approved', 'rejected', 'withdrawn']

const requestTypeTextMap = {
  proof: '证明开具',
  seal: '盖章申请'
}

const statusTextMap = {
  draft: '草稿',
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回'
}

const stepTextMap = {
  counselor: '辅导员审批',
  college: '学院复核',
  completed: '已完成'
}

function canApprove(user) {
  const permissions = (user && user.permissions) || []
  return permissions.includes('approve_requests') || permissions.includes('manage_all')
}

function canReadSensitive(user) {
  const permissions = (user && user.permissions) || []
  return permissions.includes('read_sensitive') || permissions.includes('manage_all')
}

function hasOwnRequestAccess(row, user) {
  return Number(row.applicantUserId) === Number(user.id)
}

function normalizeStatus(status) {
  return allowedStatuses.includes(status) ? status : ''
}

function mapRequestRow(row, user) {
  const sensitiveVisible = canReadSensitive(user) || hasOwnRequestAccess(row, user) || canApprove(user)
  const nextApprovalAction = row.currentStep === 'counselor' ? '提交学院复核' : '通过'
  return {
    ...row,
    requestTypeText: requestTypeTextMap[row.requestType] || row.requestType,
    statusText: statusTextMap[row.status] || row.status,
    currentStepText: stepTextMap[row.currentStep] || row.currentStep,
    confidentialDescription: sensitiveVisible
      ? row.confidentialDescription || ''
      : row.confidentialDescription
        ? '已隐藏'
        : '',
    sensitiveVisible,
    canSubmit: hasOwnRequestAccess(row, user) && ['draft', 'rejected'].includes(row.status),
    canEdit: hasOwnRequestAccess(row, user) && ['draft', 'rejected'].includes(row.status),
    canWithdraw: hasOwnRequestAccess(row, user) && row.status === 'pending',
    canApprove: canApprove(user) && row.status === 'pending',
    nextApprovalAction
  }
}

async function listMyRequests(user) {
  const result = await db.query(
    `
      select ${requestSelectFields()}
      from approval_requests ar
      left join students s on s.id = ar.student_id
      left join templates t on t.id = ar.template_id
      where ar.applicant_user_id = $1
      order by ar.updated_at desc, ar.id desc
      limit 100
    `,
    [user.id]
  )
  return result.rows.map((row) => mapRequestRow(row, user))
}

async function listPendingRequests({ status, keyword } = {}, user) {
  const values = []
  const conditions = []
  const normalizedStatus = normalizeStatus(status)
  if (normalizedStatus) {
    values.push(normalizedStatus)
    conditions.push(`ar.status = $${values.length}`)
  } else {
    conditions.push("ar.status in ('pending', 'approved', 'rejected')")
  }
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(
      `(ar.request_no ilike $${idx} or ar.title ilike $${idx} or s.student_no ilike $${idx} or s.name ilike $${idx})`
    )
  }

  const result = await db.query(
    `
      select ${requestSelectFields()}
      from approval_requests ar
      left join students s on s.id = ar.student_id
      left join templates t on t.id = ar.template_id
      where ${conditions.join(' and ')}
      order by
        case ar.status when 'pending' then 1 when 'rejected' then 2 when 'approved' then 3 else 4 end,
        ar.submitted_at desc nulls last,
        ar.updated_at desc
      limit 100
    `,
    values
  )
  return result.rows.map((row) => mapRequestRow(row, user))
}

async function getRequestDetail(id, user) {
  const result = await db.query(
    `
      select ${requestSelectFields()}
      from approval_requests ar
      left join students s on s.id = ar.student_id
      left join templates t on t.id = ar.template_id
      where ar.id = $1
      limit 1
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('approval request not found')
  }

  const row = result.rows[0]
  if (!hasOwnRequestAccess(row, user) && !canApprove(user) && !canReadSensitive(user)) {
    throw forbidden('approval request is not accessible')
  }

  const [attachments, records] = await Promise.all([
    listAttachments(id),
    listRecords(id)
  ])
  return {
    ...mapRequestRow(row, user),
    attachments,
    records
  }
}

async function getRequestForAccess(id, user) {
  const result = await db.query(
    `
      select ${requestSelectFields()}
      from approval_requests ar
      left join students s on s.id = ar.student_id
      left join templates t on t.id = ar.template_id
      where ar.id = $1
      limit 1
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('approval request not found')
  }
  const row = result.rows[0]
  if (!hasOwnRequestAccess(row, user) && !canApprove(user) && !canReadSensitive(user)) {
    throw forbidden('approval request is not accessible')
  }
  return row
}

async function saveRequest(payload, user) {
  validateRequestPayload(payload)
  const requestId = await db.withTransaction(async (client) => {
    const student = await getUserStudent(client, user.id)
    const requestType = payload.requestType
    const submitNow = Boolean(payload.submit) && !payload.deferSubmit
    const status = submitNow ? 'pending' : 'draft'
    const submittedAt = submitNow ? 'now()' : 'null'
    const previewContent = buildPreviewContent(payload, student)

    let result
    if (payload.id) {
      const current = await getRequestForUpdate(client, payload.id)
      if (!hasOwnRequestAccess(current, user) || !['draft', 'rejected'].includes(current.status)) {
        throw forbidden('approval request cannot be edited')
      }
      result = await client.query(
        `
          update approval_requests
          set request_type = $2,
              title = $3,
              purpose = $4,
              description = $5,
              confidential_description = $6,
              template_id = $7,
              status = $8,
              current_step = case when $8 = 'pending' then 'counselor' else current_step end,
              approval_level = case when $8 = 'pending' then 1 else approval_level end,
              preview_content = $9,
              rejection_reason = case when $8 = 'pending' then null else rejection_reason end,
              submitted_at = case when $8 = 'pending' then ${submittedAt} else submitted_at end,
              rejected_at = case when $8 = 'pending' then null else rejected_at end,
              updated_at = now()
          where id = $1
          returning id
        `,
        [
          payload.id,
          requestType,
          payload.title,
          payload.purpose,
          payload.description || null,
          payload.confidentialDescription || null,
          payload.templateId || null,
          status,
          previewContent
        ]
      )
    } else {
      const requestNo = buildRequestNo(requestType)
      result = await client.query(
        `
          insert into approval_requests (
            request_no,
            applicant_user_id,
            student_id,
            request_type,
            title,
            purpose,
            description,
            confidential_description,
            template_id,
            status,
            current_step,
            preview_content,
            submitted_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'counselor', $11, case when $10 = 'pending' then now() else null end)
          returning id
        `,
        [
          requestNo,
          user.id,
          student ? student.id : null,
          requestType,
          payload.title,
          payload.purpose,
          payload.description || null,
          payload.confidentialDescription || null,
          payload.templateId || null,
          status,
          previewContent
        ]
      )
    }

	    const savedRequestId = result.rows[0].id
	    if (submitNow) {
	      await validateSubmitRequirements(client, savedRequestId, payload)
	      await insertRecord(client, savedRequestId, user, 'submit', 'counselor', '提交申请')
	    }
	    return savedRequestId
	  })
	  return getRequestDetail(requestId, user)
}

async function submitRequest(id, user) {
  await db.withTransaction(async (client) => {
    const current = await getRequestForUpdate(client, id)
    if (!hasOwnRequestAccess(current, user) || !['draft', 'rejected'].includes(current.status)) {
      throw forbidden('approval request cannot be submitted')
    }
    await validateSubmitRequirements(client, id)
    await client.query(
      `
        update approval_requests
        set status = 'pending',
            current_step = 'counselor',
            approval_level = 1,
            submitted_at = now(),
            rejected_at = null,
            rejection_reason = null,
            updated_at = now()
        where id = $1
      `,
      [id]
    )
    await insertRecord(client, id, user, 'submit', 'counselor', '提交申请')
  })
  return getRequestDetail(id, user)
}

async function withdrawRequest(id, user) {
  await db.withTransaction(async (client) => {
    const current = await getRequestForUpdate(client, id)
    if (!hasOwnRequestAccess(current, user) || current.status !== 'pending') {
      throw forbidden('approval request cannot be withdrawn')
    }
    await client.query(
      `
        update approval_requests
        set status = 'withdrawn',
            updated_at = now()
        where id = $1
      `,
      [id]
    )
    await insertRecord(client, id, user, 'withdraw', current.currentStep, '申请人撤回')
  })
  return getRequestDetail(id, user)
}

async function approveRequest(id, payload, user) {
  if (!canApprove(user)) {
    throw forbidden('approval permission required')
  }
  await db.withTransaction(async (client) => {
    const current = await getRequestForUpdate(client, id)
    if (current.status !== 'pending') {
      throw badRequest('only pending requests can be approved')
    }
    if (current.currentStep === 'counselor') {
      await client.query(
        `
          update approval_requests
          set current_step = 'college',
              approval_level = 2,
              approved_by = $2,
              updated_at = now()
          where id = $1
        `,
        [id, user.id]
      )
      await insertRecord(client, id, user, 'approve_step', current.currentStep, payload && payload.comment)
      return
    }
    await client.query(
      `
        update approval_requests
        set status = 'approved',
            current_step = 'completed',
            college_reviewed_by = $2,
            college_reviewed_at = now(),
            approved_at = now(),
            updated_at = now()
        where id = $1
      `,
      [id, user.id]
    )
    await insertRecord(client, id, user, 'approve', current.currentStep, payload && payload.comment)
  })
  return getRequestDetail(id, user)
}

async function rejectRequest(id, payload, user) {
  if (!canApprove(user)) {
    throw forbidden('approval permission required')
  }
  const reason = payload && payload.reason
  if (!reason) {
    throw badRequest('rejection reason is required')
  }
  await db.withTransaction(async (client) => {
    const current = await getRequestForUpdate(client, id)
    if (current.status !== 'pending') {
      throw badRequest('only pending requests can be rejected')
    }
    await client.query(
      `
        update approval_requests
        set status = 'rejected',
            rejection_reason = $2,
            rejected_at = now(),
            updated_at = now()
        where id = $1
      `,
      [id, reason]
    )
    await insertRecord(client, id, user, 'reject', current.currentStep, reason)
  })
  return getRequestDetail(id, user)
}

async function addAttachment(requestId, file, user) {
  if (!file || !file.path) {
    throw badRequest('file is required')
  }
  return db.withTransaction(async (client) => {
    const current = await getRequestForUpdate(client, requestId)
    if (!hasOwnRequestAccess(current, user) || !['draft', 'rejected'].includes(current.status)) {
      throw forbidden('attachment cannot be uploaded')
    }
    const fileType = path.extname(file.originalname || '').replace('.', '').toLowerCase() || 'file'
    const result = await client.query(
      `
        insert into approval_attachments (
          request_id,
          original_name,
          storage_path,
          file_type,
          file_size,
          uploaded_by
        )
        values ($1, $2, $3, $4, $5, $6)
        returning
          id,
          original_name as "originalName",
          file_type as "fileType",
          file_size as "fileSize",
          to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      `,
      [requestId, file.originalname || 'attachment', file.path, fileType, file.size || 0, user.id]
    )
    await insertRecord(client, requestId, user, 'upload_attachment', current.currentStep, file.originalname || '附件')
    return result.rows[0]
  })
}

async function getAttachmentDownload(attachmentId, user) {
  const result = await db.query(
    `
      select
        aa.id,
        aa.request_id as "requestId",
        aa.original_name as "originalName",
        aa.storage_path as "storagePath",
        ar.applicant_user_id as "applicantUserId",
        ar.status
      from approval_attachments aa
      join approval_requests ar on ar.id = aa.request_id
      where aa.id = $1
      limit 1
    `,
    [attachmentId]
  )
  if (result.rowCount === 0) {
    throw notFound('attachment not found')
  }
  const row = result.rows[0]
  if (!hasOwnRequestAccess(row, user) && !canApprove(user) && !canReadSensitive(user)) {
    throw forbidden('attachment is not accessible')
  }
  if (!isSafeStoredPath(row.storagePath, path.resolve('uploads/approvals')) || !fs.existsSync(row.storagePath)) {
    throw notFound('attachment file not found')
  }
  return row
}

async function getGeneratedProof(id, user, format = 'pdf') {
  const row = await getRequestForAccess(id, user)
  if (row.requestType !== 'proof') {
    throw badRequest('only proof request can be generated')
  }
  const detail = await getProofStudentDetail(row.id)
  const content = buildProofDocumentContent(row, detail, canReadSensitive(user) || canApprove(user))
  return {
    filename: `${row.requestNo || `proof-${row.id}`}.${format === 'txt' ? 'txt' : 'pdf'}`,
    title: row.title || '证明文件',
    content
  }
}

async function listAttachments(requestId) {
  const result = await db.query(
    `
      select
        id,
        original_name as "originalName",
        file_type as "fileType",
        file_size as "fileSize",
        concat('/approvals/attachments/', id, '/download') as "downloadPath",
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      from approval_attachments
      where request_id = $1
      order by created_at asc, id asc
    `,
    [requestId]
  )
  return result.rows
}

async function listRecords(requestId) {
  const result = await db.query(
    `
      select
        id,
        operator_name as "operatorName",
        operator_role as "operatorRole",
        action,
        step,
        comment,
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      from approval_records
      where request_id = $1
      order by created_at asc, id asc
    `,
    [requestId]
  )
  return result.rows
}

async function getUserStudent(client, userId) {
  const result = await client.query(
    `
      select
        s.id,
        s.student_no as "studentNo",
        s.name,
        s.college,
        s.major,
        s.class_name as "className",
        s.grade,
        s.education_level as "educationLevel",
        s.political_status as "politicalStatus",
        s.party_stage as "partyStage",
        s.league_stage as "leagueStage"
      from users u
      left join students s on s.id = u.student_id and s.deleted_at is null
      where u.id = $1
      limit 1
    `,
    [userId]
  )
  return result.rows[0] || null
}

async function getProofStudentDetail(requestId) {
  const result = await db.query(
    `
      select
        s.student_no as "studentNo",
        s.name,
        s.college,
        s.major,
        s.class_name as "className",
        s.grade,
        s.education_level as "educationLevel",
        s.political_status as "politicalStatus",
        s.party_stage as "partyStage",
        s.league_stage as "leagueStage",
        s.id_card_encrypted as "idCardEncrypted"
      from approval_requests ar
      left join students s on s.id = ar.student_id
      where ar.id = $1
      limit 1
    `,
    [requestId]
  )
  return result.rows[0] || {}
}

async function getRequestForUpdate(client, id) {
  const result = await client.query(
    `
      select
        id,
        applicant_user_id as "applicantUserId",
        status,
        current_step as "currentStep"
      from approval_requests
      where id = $1
      for update
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('approval request not found')
  }
  return result.rows[0]
}

function buildRequestNo(requestType) {
  const prefix = requestType === 'seal' ? 'SEAL' : 'PROOF'
  const date = new Date()
  const dateText = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`.toUpperCase()
  return `${prefix}-${dateText}-${suffix}`
}

function buildPreviewContent(payload, student) {
  if (payload.requestType !== 'proof') {
    return null
  }
  const name = student && student.name ? student.name : '申请人'
  const studentNo = student && student.studentNo ? student.studentNo : '未绑定学号'
  const college = student && student.college ? student.college : '信息学院'
  const major = student && student.major ? student.major : ''
  return `${name}（学号：${studentNo}）系${college}${major ? ` ${major}` : ''}学生。兹因“${payload.purpose}”申请开具证明。具体内容以学院审核结果为准。`
}

function buildProofDocumentContent(request, student, sensitiveVisible) {
  const idCard = decryptField(student.idCardEncrypted)
  const idCardText = sensitiveVisible ? idCard : maskIdCard(idCard)
  const lines = [
    '学生证明',
    '',
    `兹证明 ${student.name || request.studentName || '申请人'}，学号 ${student.studentNo || request.studentNo || '未绑定'}，`,
    `为${student.college || '信息学院'}${student.major ? `${student.major}专业` : ''}${student.grade ? `${student.grade}级` : ''}${student.educationLevel ? `${student.educationLevel}学生` : '学生'}。`,
    idCardText ? `身份证号：${idCardText}` : '',
    student.politicalStatus ? `政治面貌：${student.politicalStatus}` : '',
    student.partyStage && student.partyStage !== 'none' ? `入党流程阶段：${student.partyStage}` : '',
    student.leagueStage && student.leagueStage !== 'none' ? `入团流程阶段：${student.leagueStage}` : '',
    '',
    `证明用途：${request.purpose}`,
    request.description ? `补充说明：${request.description}` : '',
    '',
    '本证明由信息学院学生综合服务与党团管理平台依据已登记学生信息生成，最终效力以学院审核盖章结果为准。'
  ]
  return lines.filter((line) => line !== '').join('\n')
}

function validateRequestPayload(payload) {
  if (!payload || !allowedTypes.includes(payload.requestType)) {
    throw badRequest('requestType must be proof or seal')
  }
  if (!payload.title || !payload.purpose) {
    throw badRequest('title and purpose are required')
  }
}

async function validateSubmitRequirements(client, requestId, payload = {}) {
  const result = await client.query(
    `
      select request_type as "requestType", confidential_description as "confidentialDescription"
      from approval_requests
      where id = $1
      limit 1
    `,
    [requestId]
  )
  if (result.rowCount === 0) {
    throw notFound('approval request not found')
  }
  const row = result.rows[0]
  if (row.requestType !== 'seal') {
    return
  }
  const attachmentResult = await client.query(
    'select 1 from approval_attachments where request_id = $1 limit 1',
    [requestId]
  )
  const confidentialDescription =
    payload.confidentialDescription !== undefined ? payload.confidentialDescription : row.confidentialDescription
  if (attachmentResult.rowCount === 0 && !String(confidentialDescription || '').trim()) {
    throw badRequest('seal request requires an attachment or confidential description before submit')
  }
}

async function insertRecord(client, requestId, operator, action, step, comment) {
  await client.query(
    `
      insert into approval_records (
        request_id,
        operator_id,
        operator_name,
        operator_role,
        action,
        step,
        comment
      )
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      requestId,
      operator.id,
      operator.name,
      operator.role,
      action,
      step || 'counselor',
      comment || null
    ]
  )
}

function requestSelectFields() {
  return `
    ar.id,
    ar.request_no as "requestNo",
    ar.applicant_user_id as "applicantUserId",
    ar.request_type as "requestType",
    ar.title,
    ar.purpose,
    ar.description,
    ar.confidential_description as "confidentialDescription",
    ar.status,
    ar.current_step as "currentStep",
    ar.approval_level as "approvalLevel",
    ar.approved_by as "approvedBy",
    ar.college_reviewed_by as "collegeReviewedBy",
    ar.preview_content as "previewContent",
    ar.rejection_reason as "rejectionReason",
    to_char(ar.submitted_at, 'YYYY-MM-DD HH24:MI') as "submittedAt",
    to_char(ar.approved_at, 'YYYY-MM-DD HH24:MI') as "approvedAt",
    to_char(ar.rejected_at, 'YYYY-MM-DD HH24:MI') as "rejectedAt",
    to_char(ar.updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt",
    s.student_no as "studentNo",
    s.name as "studentName",
    s.class_name as "className",
    s.major,
    t.template_name as "templateName"
  `
}

module.exports = {
  listMyRequests,
  listPendingRequests,
  getRequestDetail,
  saveRequest,
  submitRequest,
  withdrawRequest,
  approveRequest,
  rejectRequest,
  addAttachment,
  getAttachmentDownload,
  getGeneratedProof
}
