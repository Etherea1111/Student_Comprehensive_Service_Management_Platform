function dateText(date) {
  if (!date) {
    return '待确认'
  }
  return String(date).replace(/-/g, '.')
}

function percent(value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0))
  return `${Math.round(normalized * 100)}%`
}

module.exports = {
  dateText,
  percent
}
