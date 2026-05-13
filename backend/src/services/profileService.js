const db = require('../db/pool')
const { notFound } = require('../utils/errors')

async function getMe(user) {
  const result = await db.query(
    `
      select
        u.id,
        u.openid,
        u.role,
        s.student_no as "studentNo",
        coalesce(s.name, u.display_name) as name,
        s.college,
        s.major,
        s.class_name as "className",
        s.grade,
        s.political_status as "politicalStatus",
        s.party_stage as "partyStage",
        s.league_stage as "leagueStage",
        s.student_status as "studentStatus"
      from users u
      left join students s on s.id = u.student_id
      where u.id = $1
    `,
    [user.id]
  )

  if (result.rowCount === 0) {
    throw notFound('user not found')
  }

  return {
    ...result.rows[0],
    permissions: user.permissions
  }
}

module.exports = {
  getMe
}
