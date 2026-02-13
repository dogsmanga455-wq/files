// app.js - Frontend Logic
const getApiUrl = () => {
  // Obtener el origen actual (protocolo + dominio + puerto)
  const origin = window.location.origin;
  
  // La API siempre está en /api del mismo servidor
  return `${origin}/api`;
};

const API_URL = getApiUrl();
let token = localStorage.getItem('token');
let productos = [];
let carrito = [];

console.log('🌐 API URL:', API_URL);
console.log('📍 Origen:', window.location.origin);
// ==================== AUTENTICACIÓN ====================

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      errorDiv.textContent = data.error || 'Error al iniciar sesión';
      errorDiv.classList.remove('hidden');
      return;
    }

    token = data.token;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    showMainScreen();
  } catch (error) {
    errorDiv.textContent = 'Error de conexión con el servidor';
    errorDiv.classList.remove('hidden');
  }
});

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('main-screen').classList.add('hidden');
  document.getElementById('login-form').reset();
}

function showMainScreen() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  
  loadDashboard();
  loadProductos();
}

// ==================== NAVEGACIÓN ====================

function showSection(sectionName) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section').forEach(section => {
    section.classList.add('hidden');
  });

  // Remover borde activo de todos los botones
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('border-blue-600');
    btn.classList.add('border-transparent');
  });

  // Mostrar sección activa
  document.getElementById(`section-${sectionName}`).classList.remove('hidden');
  document.getElementById(`section-${sectionName}`).classList.add('fade-in');

  // Marcar botón activo
  event.target.classList.remove('border-transparent');
  event.target.classList.add('border-blue-600');

  // Cargar datos según la sección
  if (sectionName === 'dashboard') loadDashboard();
  if (sectionName === 'productos') loadProductos();
  if (sectionName === 'ventas') loadProductosVenta();
  if (sectionName === 'historial') loadHistorialVentas();
  if (sectionName === 'reportes') loadReportes();
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
  try {
    const [dashboard, stockBajo, masVendidos] = await Promise.all([
      fetch(`${API_URL}/reportes/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()),
      
      fetch(`${API_URL}/reportes/stock-bajo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()),
      
      fetch(`${API_URL}/reportes/mas-vendidos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json())
    ]);

    // Actualizar estadísticas
    document.getElementById('ventas-hoy-count').textContent = dashboard.ventasDia.total_ventas;
    document.getElementById('ventas-hoy-total').textContent = parseFloat(dashboard.ventasDia.ingresos_totales).toFixed(2);
    document.getElementById('ventas-mes-count').textContent = dashboard.ventasMes.total_ventas;
    document.getElementById('ventas-mes-total').textContent = parseFloat(dashboard.ventasMes.ingresos_totales).toFixed(2);
    document.getElementById('productos-activos').textContent = dashboard.productosActivos.total;
    document.getElementById('stock-bajo-count').textContent = dashboard.stockBajo.total;

    // Stock bajo
    const stockBajoDiv = document.getElementById('stock-bajo-list');
    if (stockBajo.length === 0) {
      stockBajoDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No hay productos con stock bajo</p>';
    } else {
      stockBajoDiv.innerHTML = stockBajo.map(p => `
  <div class="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
    <div>
      <p class="font-medium text-gray-800">${p.nombre}</p>
      <p class="text-sm text-gray-600">${p.codigo} - ${p.categoria || 'Sin categoría'}</p>
    </div>
    <div class="text-right">
      <p class="text-red-600 font-bold">${p.stock} unidades</p>
      <p class="text-xs text-gray-500">Mínimo: ${p.stock_minimo}</p>
    </div>
  </div>
`).join('');
    }

    // Más vendidos
    const masVendidosDiv = document.getElementById('mas-vendidos-list');
    if (masVendidos.length === 0) {
      masVendidosDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No hay ventas registradas aún</p>';
    } else {
      masVendidosDiv.innerHTML = masVendidos.map((p, index) => `
  <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
    <div class="flex items-center space-x-3">
      <span class="text-2xl font-bold ${index < 3 ? 'text-yellow-500' : 'text-gray-400'}">#${index + 1}</span>
      <div>
        <p class="font-medium text-gray-800">${p.nombre}</p>
        <p class="text-sm text-gray-600">${p.codigo} - ${p.categoria || 'Sin categoría'}</p>
      </div>
    </div>
    <div class="text-right">
      <p class="font-bold text-green-600">${p.total_vendido} vendidos</p>
      <p class="text-sm text-gray-600">$${parseFloat(p.ingresos_totales).toFixed(2)}</p>
    </div>
  </div>
`).join('');
    }
  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// ==================== PRODUCTOS ====================

async function loadProductos() {
  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    productos = await response.json();
    renderProductosTable();
  } catch (error) {
    console.error('Error cargando productos:', error);
  }
}

function renderProductosTable() {
  const tbody = document.getElementById('productos-table');
  
  if (productos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 text-sm">No hay productos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = productos.map(p => `
    <tr class="hover:bg-gray-50">
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">${p.codigo}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">${p.nombre}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell">${p.categoria || '-'}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm ${p.stock <= p.stock_minimo ? 'text-red-600 font-bold' : 'text-gray-900'}">
        ${p.stock}
        ${p.stock <= p.stock_minimo ? '<i class="fas fa-exclamation-triangle ml-1"></i>' : ''}
      </td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">$${parseFloat(p.precio_venta).toFixed(2)}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm space-x-2">
        <button class="btn-edit-producto text-blue-600 hover:text-blue-800" data-producto-id="${p.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-delete-producto text-red-600 hover:text-red-800" data-producto-id="${p.id}" data-producto-nombre="${p.nombre.replace(/"/g, '&quot;')}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  // Agregar event listeners para editar
  tbody.querySelectorAll('.btn-edit-producto').forEach(btn => {
    btn.addEventListener('click', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      editProducto(productoId);
    });
  });

  // Agregar event listeners para eliminar
  tbody.querySelectorAll('.btn-delete-producto').forEach(btn => {
    btn.addEventListener('click', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      const productoNombre = this.getAttribute('data-producto-nombre');
      deleteProducto(productoId, productoNombre);
    });
  });
}

function showProductModal(id = null) {
  const modal = document.getElementById('producto-modal');
  const form = document.getElementById('producto-form');
  const title = document.getElementById('modal-title');

  form.reset();
  
  if (id) {
    title.textContent = 'Editar Producto';
    const producto = productos.find(p => p.id === id);
    
    document.getElementById('producto-id').value = producto.id;
    document.getElementById('producto-codigo').value = producto.codigo;
    document.getElementById('producto-nombre').value = producto.nombre;
    document.getElementById('producto-descripcion').value = producto.descripcion || '';
    document.getElementById('producto-precio-compra').value = producto.precio_compra;
    document.getElementById('producto-precio-venta').value = producto.precio_venta;
    document.getElementById('producto-stock').value = producto.stock;
    document.getElementById('producto-stock-minimo').value = producto.stock_minimo;
    document.getElementById('producto-categoria').value = producto.categoria || '';
    
    document.getElementById('producto-codigo').disabled = true;
  } else {
    title.textContent = 'Nuevo Producto';
    document.getElementById('producto-codigo').disabled = false;
  }

  modal.classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('producto-modal').classList.add('hidden');
  document.getElementById('producto-form').reset();
}

document.getElementById('producto-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('producto-id').value;
  const data = {
    codigo: document.getElementById('producto-codigo').value,
    nombre: document.getElementById('producto-nombre').value,
    descripcion: document.getElementById('producto-descripcion').value,
    precio_compra: parseFloat(document.getElementById('producto-precio-compra').value),
    precio_venta: parseFloat(document.getElementById('producto-precio-venta').value),
    stock: parseInt(document.getElementById('producto-stock').value),
    stock_minimo: parseInt(document.getElementById('producto-stock-minimo').value),
    categoria: document.getElementById('producto-categoria').value
  };

  try {
    const url = id ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || 'Error al guardar producto');
      return;
    }

    alert(result.message);
    closeProductModal();
    loadProductos();
  } catch (error) {
    alert('Error de conexión con el servidor');
  }
});

function editProducto(id) {
  showProductModal(id);
}

async function deleteProducto(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar el producto "${nombre}"?`)) return;

  try {
    const response = await fetch(`${API_URL}/productos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || 'Error al eliminar producto');
      return;
    }

    alert('✅ ' + result.message);
    loadProductos();
  } catch (error) {
    console.error('Error eliminando producto:', error);
    alert('Error de conexión con el servidor');
  }
}

// ==================== VENTAS ====================

async function loadProductosVenta() {
  if (productos.length === 0) {
    await loadProductos();
  }
  renderProductosVenta();
}

function renderProductosVenta(searchTerm = '') {
  const container = document.getElementById('productos-venta-list');
  const filteredProductos = productos.filter(p => 
    p.stock > 0 && (
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (filteredProductos.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay productos disponibles</p>';
    return;
  }

  container.innerHTML = filteredProductos.map(p => `
    <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
      <div class="flex-1">
        <p class="font-medium text-gray-800">${p.nombre}</p>
        <p class="text-sm text-gray-600">${p.codigo} - Stock: ${p.stock}</p>
      </div>
      <div class="flex items-center space-x-2">
        <span class="font-bold text-green-600">$${parseFloat(p.precio_venta).toFixed(2)}</span>
        <button data-producto-id="${p.id}" class="btn-agregar-carrito bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Agregar event listeners a todos los botones
  container.querySelectorAll('.btn-agregar-carrito').forEach(btn => {
    btn.addEventListener('click', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      agregarAlCarrito(productoId);
    });
  });
}

document.getElementById('search-productos')?.addEventListener('input', (e) => {
  renderProductosVenta(e.target.value);
});

function agregarAlCarrito(productoId) {
  const producto = productos.find(p => p.id === productoId);
  
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }
  
  const itemCarrito = carrito.find(i => i.producto_id === productoId);

  if (itemCarrito) {
    if (itemCarrito.cantidad >= producto.stock) {
      alert('No hay suficiente stock disponible');
      return;
    }
    itemCarrito.cantidad++;
  } else {
    carrito.push({
      producto_id: productoId,
      nombre: producto.nombre,
      precio: parseFloat(producto.precio_venta),
      cantidad: 1,
      stock: producto.stock
    });
  }

  renderCarrito();
}

function quitarDelCarrito(productoId) {
  const index = carrito.findIndex(i => i.producto_id === productoId);
  if (index > -1) {
    carrito.splice(index, 1);
  }
  renderCarrito();
}

function actualizarCantidad(productoId, nuevaCantidad) {
  const item = carrito.find(i => i.producto_id === productoId);
  
  if (nuevaCantidad <= 0) {
    quitarDelCarrito(productoId);
    return;
  }

  if (nuevaCantidad > item.stock) {
    alert('No hay suficiente stock disponible');
    return;
  }

  item.cantidad = nuevaCantidad;
  renderCarrito();
}

function renderCarrito() {
  const container = document.getElementById('carrito-list');
  const btnProcesar = document.getElementById('btn-procesar-venta');

  if (carrito.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Carrito vacío</p>';
    btnProcesar.disabled = true;
    document.getElementById('total-venta').textContent = '0.00';
    return;
  }

  let total = 0;

  container.innerHTML = carrito.map(item => {
    const precio = parseFloat(item.precio);
    const subtotal = precio * item.cantidad;
    total += subtotal;

    return `
      <div class="bg-gray-50 p-3 rounded-lg">
        <div class="flex justify-between items-start mb-2">
          <p class="font-medium text-gray-800 text-sm">${item.nombre}</p>
          <button class="btn-quitar-carrito text-red-600 hover:text-red-800" data-producto-id="${item.producto_id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-2">
            <button class="btn-decrementar bg-gray-300 hover:bg-gray-400 text-gray-800 px-2 py-1 rounded text-xs" 
                    data-producto-id="${item.producto_id}" data-nueva-cantidad="${item.cantidad - 1}">
              <i class="fas fa-minus"></i>
            </button>
            <input type="number" value="${item.cantidad}" min="1" max="${item.stock}"
                   class="input-cantidad w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                   data-producto-id="${item.producto_id}">
            <button class="btn-incrementar bg-gray-300 hover:bg-gray-400 text-gray-800 px-2 py-1 rounded text-xs"
                    data-producto-id="${item.producto_id}" data-nueva-cantidad="${item.cantidad + 1}">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <p class="font-bold text-gray-800">$${subtotal.toFixed(2)}</p>
        </div>
        <p class="text-xs text-gray-500 mt-1">Precio: $${precio.toFixed(2)} c/u</p>
      </div>
    `;
  }).join('');

  // Event listeners para los botones del carrito
  container.querySelectorAll('.btn-quitar-carrito').forEach(btn => {
    btn.addEventListener('click', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      quitarDelCarrito(productoId);
    });
  });

  container.querySelectorAll('.btn-decrementar').forEach(btn => {
    btn.addEventListener('click', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      const nuevaCantidad = parseInt(this.getAttribute('data-nueva-cantidad'));
      actualizarCantidad(productoId, nuevaCantidad);
    });
  });

  container.querySelectorAll('.btn-incrementar').forEach(btn => {
    btn.addEventListener('click', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      const nuevaCantidad = parseInt(this.getAttribute('data-nueva-cantidad'));
      actualizarCantidad(productoId, nuevaCantidad);
    });
  });

  container.querySelectorAll('.input-cantidad').forEach(input => {
    input.addEventListener('change', function() {
      const productoId = parseInt(this.getAttribute('data-producto-id'));
      const nuevaCantidad = parseInt(this.value);
      actualizarCantidad(productoId, nuevaCantidad);
    });
  });

  document.getElementById('total-venta').textContent = total.toFixed(2);
  btnProcesar.disabled = false;
}

async function procesarVenta() {
  if (carrito.length === 0) return;

  if (!confirm('¿Confirmar esta venta?')) return;

  try {
    const ventaData = {
      productos: carrito.map(item => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad
      }))
    };

    const response = await fetch(`${API_URL}/ventas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(ventaData)
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || 'Error al procesar venta');
      return;
    }

    alert(`✅ Venta procesada exitosamente!\n\nFolio: ${result.folio}\nTotal: $${result.total.toFixed(2)}`);
    
    carrito = [];
    renderCarrito();
    await loadProductos();
    renderProductosVenta();
    loadDashboard();
  } catch (error) {
    console.error('Error procesando venta:', error);
    alert('Error de conexión con el servidor');
  }
}
// ==================== HISTORIAL ====================

async function loadHistorialVentas() {
  try {
    const response = await fetch(`${API_URL}/ventas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const ventas = await response.json();
    renderHistorialVentas(ventas);
  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}

function renderHistorialVentas(ventas) {
  const tbody = document.getElementById('historial-table');

  if (ventas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500 text-sm">No hay ventas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = ventas.map(v => `
    <tr class="hover:bg-gray-50">
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">${v.folio}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">${new Date(v.created_at).toLocaleString('es-MX', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden sm:table-cell">${v.vendedor}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-green-600">$${parseFloat(v.total).toFixed(2)}</td>
      <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
        <button onclick="verDetalleVenta(${v.id})" class="text-blue-600 hover:text-blue-800">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function verDetalleVenta(id) {
  try {
    const response = await fetch(`${API_URL}/ventas/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const venta = await response.json();
    
    let detalleHTML = `
      <strong>Folio:</strong> ${venta.folio}<br>
      <strong>Fecha:</strong> ${new Date(venta.created_at).toLocaleString('es-MX')}<br>
      <strong>Vendedor:</strong> ${venta.vendedor}<br>
      <strong>Total:</strong> $${parseFloat(venta.total).toFixed(2)}<br><br>
      <strong>Productos:</strong><br>
    `;

    venta.detalles.forEach(d => {
      detalleHTML += `- ${d.producto_nombre} x${d.cantidad} = $${parseFloat(d.subtotal).toFixed(2)}<br>`;
    });

    alert(detalleHTML.replace(/<br>/g, '\n').replace(/<strong>|<\/strong>/g, ''));
  } catch (error) {
    alert('Error cargando detalle de venta');
  }
}

// ==================== REPORTES ====================

async function loadReportes() {
  try {
    const [stockBajo, masVendidos] = await Promise.all([
      fetch(`${API_URL}/reportes/stock-bajo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()),
      
      fetch(`${API_URL}/reportes/mas-vendidos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json())
    ]);

    // Stock bajo
    const stockBajoDiv = document.getElementById('reporte-stock-bajo');
    if (stockBajo.length === 0) {
      stockBajoDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No hay productos con stock bajo</p>';
    } else {
      stockBajoDiv.innerHTML = stockBajo.map(p => `
        <div class="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
          <div>
            <p class="font-medium text-gray-800">${p.nombre}</p>
            <p class="text-sm text-gray-600">${p.codigo}</p>
          </div>
          <div class="text-right">
            <p class="text-red-600 font-bold">${p.stock} / ${p.stock_minimo}</p>
          </div>
        </div>
      `).join('');
    }

    // Más vendidos
    const masVendidosDiv = document.getElementById('reporte-mas-vendidos');
    if (masVendidos.length === 0) {
      masVendidosDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No hay ventas registradas</p>';
    } else {
      masVendidosDiv.innerHTML = masVendidos.map((p, i) => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <div class="flex items-center space-x-3">
            <span class="text-xl font-bold ${i < 3 ? 'text-yellow-500' : 'text-gray-400'}">#${i + 1}</span>
            <div>
              <p class="font-medium text-gray-800">${p.nombre}</p>
              <p class="text-sm text-gray-600">${p.codigo}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-green-600">${p.total_vendido} vendidos</p>
            <p class="text-sm text-gray-600">$${parseFloat(p.ingresos_totales).toFixed(2)}</p>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error cargando reportes:', error);
  }
}

// ==================== FILTROS DE VENTAS ====================

async function filtrarVentas() {
  const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
  const fechaFin = document.getElementById('filtro-fecha-fin').value;

  if (!fechaInicio && !fechaFin) {
    alert('Selecciona al menos una fecha');
    return;
  }

  try {
    let url = `${API_URL}/ventas/filtro?`;
    if (fechaInicio) url += `fecha_inicio=${fechaInicio}`;
    if (fechaFin) url += `&fecha_fin=${fechaFin}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Verificar si la respuesta es exitosa
    if (!response.ok) {
      throw new Error('Error en la respuesta del servidor');
    }
    
    const ventas = await response.json();

    // Verificar que ventas sea un array
    if (!Array.isArray(ventas)) {
      console.error('La respuesta no es un array:', ventas);
      alert('Error: respuesta inválida del servidor');
      return;
    }

    renderHistorialVentas(ventas);

    // Mostrar resumen
    mostrarResumenFiltrado(ventas);

    // Cargar productos vendidos en el período
    if (fechaInicio || fechaFin) {
      cargarProductosVendidosPeriodo(fechaInicio, fechaFin);
    }
  } catch (error) {
    console.error('Error filtrando ventas:', error);
    alert('Error al filtrar ventas: ' + error.message);
  }
}

function mostrarResumenFiltrado(ventas) {
  const resumenDiv = document.getElementById('resumen-filtrado');
  resumenDiv.classList.remove('hidden');

  const totalVentas = ventas.length;
  const ingresosTotales = ventas.reduce((sum, v) => sum + parseFloat(v.total), 0);
  const ticketPromedio = totalVentas > 0 ? ingresosTotales / totalVentas : 0;

  document.getElementById('resumen-total-ventas').textContent = totalVentas;
  document.getElementById('resumen-ingresos').textContent = '$' + ingresosTotales.toFixed(2);
  document.getElementById('resumen-promedio').textContent = '$' + ticketPromedio.toFixed(2);
}

async function cargarProductosVendidosPeriodo(fechaInicio, fechaFin) {
  try {
    let url = `${API_URL}/reportes/productos-vendidos-fecha?`;
    if (fechaInicio) url += `fecha_inicio=${fechaInicio}`;
    if (fechaFin) url += `&fecha_fin=${fechaFin}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Error en la respuesta del servidor');
    }
    
    const productos = await response.json();

    // Verificar que productos sea un array
    if (!Array.isArray(productos)) {
      console.error('La respuesta no es un array:', productos);
      return;
    }
    
    const productosDiv = document.getElementById('productos-periodo');
    const listaDiv = document.getElementById('productos-vendidos-list');

    if (productos.length === 0) {
      productosDiv.classList.add('hidden');
      return;
    }

    productosDiv.classList.remove('hidden');

    listaDiv.innerHTML = productos.map((p, index) => `
      <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
        <div class="flex items-center space-x-3">
          <span class="text-xl font-bold ${index < 3 ? 'text-yellow-500' : 'text-gray-400'}">#${index + 1}</span>
          <div>
            <p class="font-medium text-gray-800">${p.producto_nombre}</p>
            <p class="text-sm text-gray-600">${p.num_ventas} venta(s)</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-bold text-blue-600">${p.cantidad_vendida} unidades</p>
          <p class="text-sm text-green-600">$${parseFloat(p.total_vendido).toFixed(2)}</p>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error cargando productos vendidos:', error);
    // No mostrar alert aquí, solo log
  }
}
function limpiarFiltros() {
  document.getElementById('filtro-fecha-inicio').value = '';
  document.getElementById('filtro-fecha-fin').value = '';
  document.getElementById('resumen-filtrado').classList.add('hidden');
  document.getElementById('productos-periodo').classList.add('hidden');
  loadHistorialVentas();
}

function exportarVentasCSV() {
  const tabla = document.getElementById('historial-table');
  const filas = tabla.querySelectorAll('tr');
  
  if (filas.length === 0) {
    alert('No hay ventas para exportar');
    return;
  }

  let csv = 'Folio,Fecha,Vendedor,Total\n';
  
  filas.forEach(fila => {
    const celdas = fila.querySelectorAll('td');
    if (celdas.length >= 4) {
      const datos = [
        celdas[0].textContent.trim(),
        celdas[1].textContent.trim(),
        celdas[2].textContent.trim(),
        celdas[3].textContent.trim().replace('$', '')
      ];
      csv += datos.join(',') + '\n';
    }
  });

  // Crear y descargar archivo
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `ventas_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Actualizar la función showSection para incluir los filtros de fecha
const originalShowSection = showSection;
showSection = function(sectionName) {
  originalShowSection.call(this, sectionName);
  
  // Si es historial, establecer fechas por defecto
  if (sectionName === 'historial') {
    const hoy = new Date().toISOString().split('T')[0];
    if (!document.getElementById('filtro-fecha-inicio').value) {
      document.getElementById('filtro-fecha-inicio').value = hoy;
      document.getElementById('filtro-fecha-fin').value = hoy;
    }
  }
};

// ==================== INICIALIZACIÓN ====================

if (token) {
  showMainScreen();
}
