const announcementService = require('../../services/announcementService')
const templateService = require('../../services/templateService')
const authGuard = require('../../utils/authGuard')

Page({
  data: {
    keyword: '',
    tags: [],
    tagItems: [],
    activeTag: '全部',
    unreadOnly: false,
    announcements: [],
    activeAnnouncement: null
  },

  onLoad() {
    if (!authGuard.ensureLoggedIn()) {
      return
    }
    announcementService.fetchTags().then((tags) => {
      const tagNames = tags.map((item) => item.name || item)
      this.setData({
        tags: tagNames,
        tagItems: this.buildTagItems(tagNames, this.data.activeTag)
      })
    })
    this.refreshAnnouncements()
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    })
  },

  onSearch() {
    this.refreshAnnouncements()
  },

  toggleUnreadOnly() {
    this.setData({
      unreadOnly: !this.data.unreadOnly
    })
    this.refreshAnnouncements()
  },

  onTagTap(event) {
    const tag = event.currentTarget.dataset.tag
    this.setData({
      activeTag: tag,
      tagItems: this.buildTagItems(this.data.tags, tag)
    })
    this.refreshAnnouncements()
  },

  refreshAnnouncements() {
    announcementService
      .fetchAnnouncements({
        keyword: this.data.keyword,
        tag: this.data.activeTag,
        unreadOnly: this.data.unreadOnly
      })
      .then((items) => {
        this.setData({
          announcements: items.map((item) => ({
            ...item,
            priorityClass: item.priority === 'urgent' || item.priority === 'high' ? 'warn' : 'neutral',
            readClass: item.isRead ? 'neutral' : 'success',
            readText: item.isRead ? '已读' : '未读',
            tagsText: (item.tags || []).join('、')
          }))
        })
      })
  },

  openAnnouncement(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.announcements.find((announcement) => String(announcement.id) === String(id))
    if (!item) {
      return
    }
    announcementService.markAsRead(id).then(() => {
      this.setData({
        activeAnnouncement: {
          ...item,
          isRead: true,
          readText: '已读',
          readClass: 'neutral'
        }
      })
      this.refreshAnnouncements()
    })
  },

  closeDetail() {
    this.setData({
      activeAnnouncement: null
    })
  },

  noop() {},

  copySource(event) {
    const url = event.currentTarget.dataset.url
    templateService.copyTemplateLink(url)
  },

  buildTagItems(tags, activeTag) {
    return tags.map((name) => ({
      name,
      activeClass: name === activeTag ? 'active' : ''
    }))
  }
})
