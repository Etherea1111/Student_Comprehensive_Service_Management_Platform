const knowledgeService = require('../../services/knowledgeService')
const templateService = require('../../services/templateService')

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
  }
})
