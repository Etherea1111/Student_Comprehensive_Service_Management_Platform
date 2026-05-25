const approvalService = require('../../services/approvalService')
const authGuard = require('../../utils/authGuard')

const emptyForm = {
  id: '',
  requestType: 'proof',
  title: '',
  purpose: '',
  description: '',
  confidentialDescription: ''
}

Page({
  data: {
    form: { ...emptyForm },
    selectedFile: null,
    selectedFileName: '未选择附件',
    myRequests: [],
    proofTypeClass: 'active',
    sealTypeClass: '',
    activeRequest: null
  },

  onLoad() {
    if (!authGuard.ensureLoggedIn()) {
      return
    }
    this.refreshRequests()
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      form: {
        ...this.data.form,
        [field]: event.detail.value
      }
    })
  },

  switchType(event) {
    const requestType = event.currentTarget.dataset.type
    this.setData({
      form: {
        ...this.data.form,
        requestType
      },
      proofTypeClass: requestType === 'proof' ? 'active' : '',
      sealTypeClass: requestType === 'seal' ? 'active' : ''
    })
  },

  chooseAttachment() {
    if (!wx.chooseMessageFile) {
      wx.showToast({ title: '当前端暂不支持文件选择', icon: 'none' })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['doc', 'docx', 'pdf', 'jpg', 'png'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) {
          return
        }
        this.setData({
          selectedFile: file,
          selectedFileName: file.name || '已选择附件'
        })
      }
    })
  },

  saveDraft() {
    this.save(false)
  },

  submitRequest() {
    this.save(true)
  },

  save(submit) {
    const form = this.data.form
    if (!form.title || !form.purpose) {
      wx.showToast({ title: '请填写标题和用途', icon: 'none' })
      return
    }
    if (form.requestType === 'seal' && !this.data.selectedFile && !form.id && !form.confidentialDescription) {
      wx.showToast({ title: '盖章申请需上传附件或填写涉密说明', icon: 'none' })
      return
    }
    const shouldUploadFirst = submit && this.data.selectedFile
    approvalService
      .saveRequest({
        ...form,
        submit,
        deferSubmit: shouldUploadFirst
      })
      .then((request) => {
        if (!this.data.selectedFile || !request.id) {
          return request
        }
        return approvalService
          .uploadAttachment(request.id, this.data.selectedFile.path || this.data.selectedFile.tempFilePath)
          .then(() => request)
      })
      .then((request) => {
        if (submit && shouldUploadFirst && request.id) {
          return approvalService.submitRequest(request.id)
        }
        return request
      })
      .then(() => {
        wx.showToast({ title: submit ? '已提交' : '已保存', icon: 'success' })
        this.setData({
          form: { ...emptyForm },
          selectedFile: null,
          selectedFileName: '未选择附件',
          proofTypeClass: 'active',
          sealTypeClass: ''
        })
        this.refreshRequests()
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      })
  },

  refreshRequests() {
    approvalService.fetchMyRequests().then((items) => {
      this.setData({
        myRequests: items.map((item) => ({
          ...item,
          statusClass: item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'warn' : 'neutral'
        }))
      })
    })
  },

  editRequest(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.myRequests.find((request) => String(request.id) === String(id))
    if (!item) {
      return
    }
    this.setData({
      form: {
        id: item.id,
        requestType: item.requestType,
        title: item.title,
        purpose: item.purpose,
        description: item.description || '',
        confidentialDescription: item.confidentialDescription === '已隐藏' ? '' : item.confidentialDescription || ''
      },
      proofTypeClass: item.requestType === 'proof' ? 'active' : '',
      sealTypeClass: item.requestType === 'seal' ? 'active' : ''
    })
  },

  withdrawRequest(event) {
    const id = event.currentTarget.dataset.id
    approvalService.withdrawRequest(id).then(() => {
      wx.showToast({ title: '已撤回', icon: 'success' })
      this.refreshRequests()
    })
  },

  openRequest(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.myRequests.find((request) => String(request.id) === String(id))
    if (!item) {
      return
    }
    this.setData({
      activeRequest: item
    })
    approvalService.fetchRequestDetail(id).then((detail) => {
      if (detail) {
        this.setData({ activeRequest: detail })
      }
    })
  },

  openAttachment(event) {
    const id = event.currentTarget.dataset.id
    const attachment = ((this.data.activeRequest && this.data.activeRequest.attachments) || []).find(
      (item) => String(item.id) === String(id)
    )
    const url = approvalService.getAttachmentUrl(attachment)
    if (!url) {
      wx.showToast({ title: '附件链接不可用', icon: 'none' })
      return
    }
    wx.downloadFile({
      url,
      header: approvalService.getDownloadHeader(),
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          wx.showToast({ title: '附件下载失败', icon: 'none' })
          return
        }
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true
        })
      },
      fail: () => wx.showToast({ title: '附件下载失败', icon: 'none' })
    })
  },

  openProofPdf() {
    const url = approvalService.getProofPdfUrl(this.data.activeRequest)
    if (!url) {
      wx.showToast({ title: '证明下载链接不可用', icon: 'none' })
      return
    }
    wx.downloadFile({
      url,
      header: approvalService.getDownloadHeader(),
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          wx.showToast({ title: '证明生成失败', icon: 'none' })
          return
        }
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true
        })
      },
      fail: () => wx.showToast({ title: '证明下载失败', icon: 'none' })
    })
  },

  closeDetail() {
    this.setData({
      activeRequest: null
    })
  },

  noop() {
  }
})
