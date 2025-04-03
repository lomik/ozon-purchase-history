class OzonAPI {
  constructor () {}

  /**
   * Получает куки для Ozon
   * @returns {Promise<Array>} Массив куков
   */
  async _getCookies () {
    return new Promise(resolve => {
      chrome.cookies.getAll(
        {
          domain: 'ozon.ru'
        },
        cookies => resolve(cookies || [])
      )
    })
  }

  /**
   * Получает содержимое страницы с авторизацией
   * @param {string} url - URL для загрузки
   * @returns {Promise<string>} HTML страницы
   */
  async fetchPage (url) {
    // Проверяем URL
    if (!url.includes('ozon.ru')) {
      throw new Error('Метод работает только с Ozon')
    }

    // Получаем куки
    const cookies = await this._getCookies()

    if (!cookies.length) {
      chrome.tabs.create({ url: 'https://ozon.ru' })
      throw new Error('Авторизуйтесь на Ozon и обновите страницу')
    }

    // Формируем запрос
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: cookieString,
          'User-Agent': navigator.userAgent
        },
        credentials: 'include'
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      return await response.text()
    } catch (error) {
      console.error('Ошибка загрузки:', error)
      throw error
    }
  }

  /**
   * Улучшенная версия fetchData с фильтрацией и валидацией
   * @param {string} url - URL страницы
   * @param {Object} [options] - Дополнительные параметры
   * @param {string} [options.selector='[data-state]'] - Кастомный CSS-селектор
   * @param {Function} [options.filter] - Функция для фильтрации результатов
   * @param {boolean} [options.merge=false] - Объединить все данные в один объект
   * @returns {Promise<Array|Object>} Данные из data-state
   */
  async fetchData (
    url,
    { selector = '[data-state]', filter = null, merge = false } = {}
  ) {
    const html = await this.fetchPage(url)
    const doc = new DOMParser().parseFromString(html, 'text/html')

    const results = Array.from(doc.querySelectorAll(selector))
      .map(element => {
        try {
          return JSON.parse(element.getAttribute('data-state') || {})
        } catch {
          return {}
        }
      })
      .filter(data => Object.keys(data).length > 0)

    // Применяем фильтр если он задан
    const filtered = filter ? results.filter(filter) : results

    return merge ? Object.assign({}, ...filtered) : filtered
  }

  // --- Методы-заглушки ---

  /**
   * Получить ID текущего пользователя
   * @returns {Promise<number>} ID пользователя или 0 если не удалось определить
   */
  async getCurrentUserId () {
    try {
      const data = await this.fetchData(
        'https://www.ozon.ru/my/orderlist?selectedTab=archive',
        {
          filter: item => item?.orderList?.length > 0
        }
      )

      // Ищем первый валидный orderList с номером заказа
      const orderWithUserId = data
        .flatMap(item => item.orderList)
        .find(order => order?.header?.number)

      if (!orderWithUserId) {
        console.warn('Не найдено заказов с номером')
        return 0
      }

      // Извлекаем ID из формата "1234567-987-654"
      const userId = parseInt(orderWithUserId.header.number.split('-')[0])

      if (!userId || isNaN(userId)) {
        console.warn(
          'Не удалось извлечь ID из номера:',
          orderWithUserId.header.number
        )
        return 0
      }

      return userId
    } catch (error) {
      console.error('Ошибка при получении ID пользователя:', error)
      return 0
    }
  }

  /**
   * Получить данные одного заказа по ID.
   * @param {string} userId - ID пользователя
   * @param {string|number} orderNumber - Номер заказа
   * @returns {Promise<Array<object>>} Массив товаров в заказе
   */
  async getOrder (userId, orderNumber) {
    try {
      const formattedOrderNumber = orderNumber.toString().padStart(4, '0')
      const orderId = `${userId}-${formattedOrderNumber}`
      const url = `https://www.ozon.ru/my/orderdetails/?order=${orderId}`

      const data = await this.fetchData(url)
      console.log(`Получение заказа ${orderId}`)

      const products = new Map()

      for (const item of data) {
        if (!item?.shipmentId || !item?.items) continue

        for (const orderItem of item.items) {
          if (!orderItem?.sellers) continue

          for (const seller of orderItem.sellers) {
            if (!seller?.products) continue

            for (const product of seller.products) {
              if (!product?.title?.common?.action?.id) continue

              const sku = product.title.common.action.id
              const key = `${userId}_${formattedOrderNumber}_${sku}`

              if (products.has(key)) {
                products.get(key).quantity += 1
              } else {
                products.set(key, {
                  user_id: userId,
                  order_number: formattedOrderNumber,
                  seller_name: seller.name?.text || 'Unknown',
                  product_name: product.title?.name?.text || 'Unknown',
                  product_link: product.title?.common?.action?.link || '',
                  product_image: product.picture?.image?.image || '',
                  product_sku: sku,
                  product_price: product.price?.price?.[0]?.text || '0 ₽',
                  quantity: 1,
                  added_date: new Date().toISOString()
                })
              }
            }
          }
        }
      }

      return Array.from(products.values())
    } catch (error) {
      console.error(
        `Ошибка при получении заказа ${userId}-${orderNumber}:`,
        error
      )
      throw new Error(`Не удалось получить заказ: ${error.message}`)
    }
  }
}

// Экспорт класса для использования в других файлах
export default OzonAPI
