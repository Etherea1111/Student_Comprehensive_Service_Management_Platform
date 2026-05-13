function openTemplate(template) {
  if (!template || !template.url) {
    wx.showToast({
      title: '模板链接为空',
      icon: 'none'
    })
    return
  }

  wx.showLoading({
    title: '正在获取模板'
  })

  wx.downloadFile({
    url: template.url,
    success: (res) => {
      if (res.statusCode !== 200 || !res.tempFilePath) {
        copyTemplateLink(template.url)
        return
      }
      wx.openDocument({
        filePath: res.tempFilePath,
        showMenu: true,
        fail: () => copyTemplateLink(template.url),
        complete: () => wx.hideLoading()
      })
    },
    fail: () => copyTemplateLink(template.url),
    complete: () => wx.hideLoading()
  })
}

function copyTemplateLink(url) {
  wx.setClipboardData({
    data: url,
    success: () => {
      wx.showToast({
        title: '链接已复制',
        icon: 'success'
      })
    }
  })
}

module.exports = {
  openTemplate,
  copyTemplateLink
}
