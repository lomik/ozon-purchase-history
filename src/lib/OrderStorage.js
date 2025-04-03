// /src/lib/OrderStorage.js

export class OrderStorage {
  constructor () {
    this.dbName = 'OzonOrdersDB'
    this.storeName = 'products'
    this.db = null
  }

  async _initDB () {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onupgradeneeded = event => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: ['user_id', 'order_number', 'product_sku']
          })
          store.createIndex('by_user', 'user_id')
        }
      }

      request.onsuccess = event => {
        this.db = event.target.result
        resolve()
      }

      request.onerror = event => {
        reject(`DB error: ${event.target.error}`)
      }
    })
  }

  async addProduct (product) {
    if (!this.db) await this._initDB()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const request = store.put(product)

      request.onsuccess = () => resolve()
      request.onerror = event => reject(event.target.error)
    })
  }

  async getProductsByUser (userId) {
    if (!this.db) await this._initDB()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.index('by_user').getAll(IDBKeyRange.only(userId))

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = event => reject(event.target.error)
    })
  }

  /**
   * Получает максимальный номер заказа для указанного пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>} Максимальный номер заказа (0 если нет данных)
   */
  async getMaxOrderNumber (userId) {
    if (!this.db) await this._initDB()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('by_user')
      const request = index.openCursor(IDBKeyRange.only(userId))

      let maxOrderNumber = 0

      request.onsuccess = event => {
        const cursor = event.target.result
        if (cursor) {
          const orderNumber = parseInt(cursor.value.order_number)
          if (!isNaN(orderNumber) && orderNumber > maxOrderNumber) {
            maxOrderNumber = orderNumber
          }
          cursor.continue()
        } else {
          resolve(maxOrderNumber)
        }
      }

      request.onerror = event => {
        console.error('Error finding max order number:', event.target.error)
        reject(event.target.error)
      }
    })
  }

  /**
   * Полностью очищает базу данных
   * @returns {Promise<void>}
   */
  async clear () {
    if (this.db) {
      this.db.close()
      this.db = null
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName)

      request.onsuccess = () => {
        console.log('База данных успешно удалена')
        this.db = null
        resolve()
      }

      request.onerror = event => {
        console.error('Ошибка удаления базы:', event.target.error)
        reject(event.target.error)
      }

      request.onblocked = () => {
        console.warn('Удаление базы заблокировано')
        reject(new Error('Удаление базы заблокировано'))
      }
    })
  }
}

// Экспорт класса для использования в других файлах
export default OrderStorage
