const knowledgeService = require('../../services/knowledgeService')
const templateService = require('../../services/templateService')
const authGuard = require('../../utils/authGuard')

Page({
  data: {
    keyword: '',
    categories: [],
    categoryItems: [],
    activeCategory: '全部',
    results: [],
    templateCategories: [],
    templateCategoryItems: [],
    activeTemplateCategory: '全部',
    templates: []
  },

  onLoad() {
    if (!authGuard.ensureLoggedIn()) {
      return
    }
    knowledgeService.fetchCategories().then((categories) => {
      this.setData({
        categories,
        categoryItems: this.buildCategoryItems(categories, this.data.activeCategory)
      })
    })
    knowledgeService.fetchTemplateCategories().then((templateCategories) => {
      this.setData({
        templateCategories,
        templateCategoryItems: this.buildCategoryItems(templateCategories, this.data.activeTemplateCategory)
      })
    })
    this.refreshKnowledge()
    this.refreshTemplates()
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    })
  },

  onSearch() {
    this.refreshKnowledge()
  },

  onCategoryTap(event) {
    this.setData({
      activeCategory: event.currentTarget.dataset.category,
      categoryItems: this.buildCategoryItems(this.data.categories, event.currentTarget.dataset.category)
    })
    this.refreshKnowledge()
  },

  onTemplateCategoryTap(event) {
    this.setData({
      activeTemplateCategory: event.currentTarget.dataset.category,
      templateCategoryItems: this.buildCategoryItems(
        this.data.templateCategories,
        event.currentTarget.dataset.category
      )
    })
    this.refreshTemplates()
  },

  refreshKnowledge() {
    knowledgeService.fetchKnowledge(this.data.keyword, this.data.activeCategory).then((results) => {
      this.setData({
        results
      })
    })
  },

  refreshTemplates() {
    knowledgeService.fetchTemplates(this.data.activeTemplateCategory).then((templates) => {
      this.setData({
        templates
      })
    })
  },

  copyLink(event) {
    const url = event.currentTarget.dataset.url
    templateService.copyTemplateLink(url)
  },

  buildCategoryItems(categories, activeCategory) {
    return categories.map((name) => ({
      name,
      activeClass: name === activeCategory ? 'active' : ''
    }))
  },

  downloadTemplate(event) {
    const id = event.currentTarget.dataset.id
    const template = this.data.templates.find((item) => item.id === id)
    templateService.openTemplate(template)
  },

  reportKnowledgeIssue(event) {
    const itemId = event.currentTarget.dataset.id || ''
    const feedbackType = itemId ? 'unresolved' : 'missing'
    wx.showModal({
      title: itemId ? '反馈答复问题' : '提交补充建议',
      editable: true,
      placeholderText: '请说明未解决的问题或希望补充的政策',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        const comment = String(res.content || '').trim()
        if (!comment && !this.data.keyword) {
          wx.showToast({
            title: '请填写反馈内容',
            icon: 'none'
          })
          return
        }
        knowledgeService
          .submitKnowledgeFeedback({
            knowledgeItemId: itemId || undefined,
            queryText: this.data.keyword,
            feedbackType,
            comment
          })
          .then(() => {
            wx.showToast({
              title: '已提交反馈',
              icon: 'success'
            })
          })
          .catch((error) => {
            wx.showToast({
              title: error.message || '反馈提交失败',
              icon: 'none'
            })
          })
      }
    })
  }
})
