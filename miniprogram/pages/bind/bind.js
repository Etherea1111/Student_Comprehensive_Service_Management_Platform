const authService = require('../../services/authService')

Page({
  data: {
    studentNo: '',
    name: ''
  },

  onStudentNoInput(event) {
    this.setData({ studentNo: event.detail.value })
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value })
  },

  submitBind() {
    if (!/^\d{10}$/.test(this.data.studentNo)) {
      wx.showToast({ title: '请输入 10 位学号', icon: 'none' })
      return
    }
    if (!this.data.name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    wx.showLoading({ title: '正在绑定' })
    authService
      .bindStudent({
        studentNo: this.data.studentNo,
        name: this.data.name
      })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '绑定成功', icon: 'success' })
        wx.reLaunch({ url: '/pages/home/home' })
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '绑定失败',
          icon: 'none'
        })
      })
  }
})
