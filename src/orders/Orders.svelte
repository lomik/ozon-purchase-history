<script>
  import { tick } from "svelte";
  import OzonAPI from "../lib/OzonAPI.js";
  import OrderStorage from "../lib/OrderStorage.js";
  import OrderManager from "../lib/OrderManager.js";

  const ozonApi = new OzonAPI();
  const orderStorage = new OrderStorage();
  const orderManager = new OrderManager();

  let isLoading = false;
  let error = null;
  let orders = [];
  let searchQuery = "";
  let userId = null;
  let currentOrderNumber = null;

  // Реактивная фильтрация
  $: filteredOrders = orders.filter((order) =>
    Object.values(order).some((value) =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  async function init() {
    await tick(); // Ждём следующий цикл рендеринга

    try {
      userId = await ozonApi.getCurrentUserId();
      if (!userId) throw new Error("Не удалось получить ID пользователя");
      await load();
    } catch (err) {
      error = err.message;
    }
  }

  // Загрузка заказов из хранилища
  async function load() {
    // isLoading = true;
    try {
      // const currentUser = await ozonApi.getCurrentUserId();
      const rawOrders = await orderStorage.getProductsByUser(userId);

      // Сортировка по номеру заказа (от новых к старым)
      orders = rawOrders.sort((a, b) => {
        const numA = parseInt(a.order_number);
        const numB = parseInt(b.order_number);
        return numB - numA; // Сортировка по убыванию
      });
    } catch (err) {
      error = "Ошибка загрузки: " + err.message;
    } finally {
      // isLoading = false;
    }
  }

  // Обновление через OrderManager
  async function refresh() {
    isLoading = true;
    error = null;
    try {
      console.log(userId);
      // const currentUser = await ozonApi.getCurrentUserId();
      const result = await orderManager.fetchAndSaveNewOrders(
        userId,
        async (orderNum) => {
          currentOrderNumber = orderNum;
          await load();
        }
      );
      console.log(`Добавлено ${result.total} новых товаров`);
      currentOrderNumber = null;
      await load();
    } catch (err) {
      error = "Ошибка обновления: " + err.message;
    } finally {
      isLoading = false;
    }
  }

  let showConfirmDialog = false;
  let operationStatus = null; // 'success' | 'error' | null

  // Функция полной очистки базы
  async function clear() {
    try {
      console.log("Начало очистки базы данных");
      await orderStorage.clear(); // Вызываем метод очистки из OrderStorage}
      orders = []; // Очищаем локальное состояние

      // Показываем статус
      operationStatus = "success";
      await tick();

      console.log("База данных полностью очищена");
      await load();
    } catch (err) {
      console.error("Ошибка при очистке базы:", err);
      operationStatus = "error";
    } finally {
      // Скрываем диалог подтверждения
      showConfirmDialog = false;

      // Автоматически скрываем статус через 3 секунды
      setTimeout(() => {
        operationStatus = null;
      }, 3000);
    }
  }

  init();
</script>

<div class="container">
  <!-- Панель кнопок -->
  <div class="grid">
    <button on:click={refresh} class="outline" disabled={isLoading}>
      {isLoading ? "Загрузка..." + (currentOrderNumber ? ' #'+currentOrderNumber : '') : "Обновить заказы"}
    </button>
    <button on:click={() => (showConfirmDialog = true)} class="outline secondary">
      Очистить базу данных
    </button>
  </div>

  <!-- Диалог подтверждения -->
  {#if showConfirmDialog}
  <dialog open>
    <article>
      <h2>Очистка базы</h2>
      <p>
        Вы уверены, что хотите полностью очистить базу данных?
      </p>
      <footer>
        <button on:click={() => (showConfirmDialog = false)} class="secondary outline">
          Отменить
        </button>
        <button on:click={clear} class="clear outline">Очистить</button>
      </footer>
    </article>
  </dialog>
  {/if}

  <!-- Статусное уведомление -->
  {#if operationStatus === "success"}
    <div class="status success">База данных успешно очищена</div>
  {:else if operationStatus === "error"}
    <div class="status error">Ошибка при очистке базы</div>
  {/if}

  <!-- Сообщения об ошибках -->
  {#if error}
    <div class="error-message">{error}</div>
  {:else if orders.length === 0 && !isLoading}
    <div class="empty-state">Нет данных о заказах</div>
  {/if}

  <!-- Поиск -->
  <input
    type="text"
    bind:value={searchQuery}
    placeholder="Поиск по заказам..."
    aria-label="Search"
  />

  <!-- Таблица заказов -->
  {#if filteredOrders.length > 0}
    <table role="grid">
      <thead>
        <tr>
          <th>Заказ</th>
          <th>Товар</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredOrders as order}
          <tr>
            <td>
              <a
                href={"https://www.ozon.ru/my/orderdetails/?order=" +
                  order.user_id +
                  "-" +
                  order.order_number}
                target="_blank"
                rel="noopener"
              >
                {order.order_number}
              </a>
            </td>
            <td class="product-info">
              <div class="product-name">
                <a
                  href={"https://ozon.ru" + order.product_link}
                  target="_blank"
                  rel="noopener"
                >
                  {order.product_name}
                </a>
              </div>
              <div class="product-details">
                <span class="seller">{order.seller_name}</span>
                <span class="price">
                  {order.quantity > 1
                    ? `${order.quantity} × `
                    : ""}{order.product_price}
                </span>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if searchQuery}
    <p>Ничего не найдено по запросу "{searchQuery}"</p>
  {/if}
</div>

<style>
  .container {
    margin-top: 1rem;
  }
  .grid {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  input {
    margin-bottom: 1rem;
    width: 100%;
    padding: 0.5rem;
  }
  .error-message {
    color: var(--pico-color-red-600);
    margin-bottom: 1rem;
  }
  .empty-state {
    opacity: 0.7;
    margin: 1rem 0;
  }
  table {
    width: 100%;
    margin-top: 1rem;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 0.5rem;
    text-align: left;
  }
  a {
    color: var(--pico-primary);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }

  .product-info {
    padding: 12px 16px;
  }

  .product-name {
    margin-bottom: 4px;
  }

  .product-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #666;
  }

  .seller {
    font-style: italic;
  }

  .price {
    font-weight: 500;
  }

  .status {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    border-width: 1px;
    border-style: solid;
  }

  .success {
    border-color: var(--form-element-valid-active-border-color);
  }

  .error {
    border-color: var(--form-element-invalid-active-border-color);
  }

  .clear {
    color: var(--del-color);
    border-color: var(--del-color);
  }
</style>
