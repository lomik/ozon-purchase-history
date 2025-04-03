import OzonAPI from './OzonAPI.js'
import OrderStorage from './OrderStorage.js'

class OrderManager {
  constructor () {
    this.ozonApi = new OzonAPI()
    this.orderStorage = new OrderStorage()
    this.batchSize = 5 // Количество параллельных запросов
  }

  /**
   * Получает и сохраняет новые заказы пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<{total: number, lastOrder: number}>} - Общее количество новых заказов и последний номер
   */
  async fetchAndSaveNewOrders (userId, progressCallback = null) {
    try {
      // 1. Получаем текущий максимальный номер заказа
      const lastSavedOrder = await this.orderStorage.getMaxOrderNumber(userId)
      let currentOrderNumber = lastSavedOrder + 1
      let newOrdersCount = 0

      // 2. Последовательно проверяем следующие номера
      while (true) {
        const orderPromises = []
        if (progressCallback != null) {
          await progressCallback(currentOrderNumber + 1)
        }

        // Создаем пакет запросов
        for (let i = 0; i < this.batchSize; i++) {
          orderPromises.push(
            this.ozonApi.getOrder(userId, currentOrderNumber + i).catch(e => []) // При ошибке возвращаем пустой массив
          )
        }

        // Выполняем пакет запросов
        const results = await Promise.all(orderPromises)
        let hasValidOrders = false

        // Обрабатываем результаты
        for (let i = 0; i < results.length; i++) {
          const orderItems = results[i]

          if (!orderItems || orderItems.length === 0) {
            // Пустой заказ - прерываем цикл
            if (i === 0)
              return {
                total: newOrdersCount,
                lastOrder: currentOrderNumber - 1
              }
            break
          }

          // Сохраняем товары заказа
          for (const item of orderItems) {
            await this.orderStorage.addProduct(item)
          }

          newOrdersCount += orderItems.length
          hasValidOrders = true
        }

        if (!hasValidOrders) break
        currentOrderNumber += this.batchSize
      }

      return { total: newOrdersCount, lastOrder: currentOrderNumber - 1 }
    } catch (error) {
      console.error('Ошибка при получении новых заказов:', error)
      throw error
    }
  }
}

// Экспорт класса для использования в других файлах
export default OrderManager
