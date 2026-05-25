function resolveChannels(payloadChannels) {
  const configured = (process.env.NOTIFICATION_CHANNELS || 'miniprogram')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const requested = Array.isArray(payloadChannels) && payloadChannels.length ? payloadChannels : configured
  return Array.from(new Set(requested.concat('miniprogram')))
}

async function deliver(channel, announcement, recipient) {
  if (channel === 'miniprogram') {
    return { status: 'delivered', message: '' }
  }
  if (channel === 'email') {
    return deliverEmail(announcement, recipient)
  }
  if (channel === 'wechat') {
    return deliverWechat(announcement, recipient)
  }
  return { status: 'failed', message: `unsupported channel: ${channel}` }
}

async function deliverEmail(announcement, recipient) {
  if (process.env.EMAIL_DELIVERY_ENABLED !== 'true') {
    return { status: 'pending', message: 'email provider is not configured' }
  }
  // Provider hook: integrate SMTP or college email API here.
  return {
    status: 'pending',
    message: `email queued for ${recipient.accountName || recipient.studentNo || recipient.userId}`
  }
}

async function deliverWechat(announcement, recipient) {
  if (process.env.WECHAT_DELIVERY_ENABLED !== 'true') {
    return { status: 'pending', message: 'wechat subscription provider is not configured' }
  }
  // Provider hook: integrate WeChat subscription message API here.
  return {
    status: 'pending',
    message: `wechat message queued for ${recipient.accountName || recipient.studentNo || recipient.userId}`
  }
}

module.exports = {
  resolveChannels,
  deliver
}
