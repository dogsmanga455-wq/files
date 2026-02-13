// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { generateToken, verifyToken } = require('./config/jwt');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
const corsOptions = process.env.FRONTEND_URL === 'same-origin' 
  ? {
      origin: true, // Permite el mismo origen
      credentials: true
    }
  : {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
      optionsSuccessStatus: 200
    };

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});
// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const query = 'SELECT * FROM usuarios WHERE username = ?';
  
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error('Error en login:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = results[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(user.id, user.username);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre
      }
    });
  });
});

// ==================== RUTAS DE PRODUCTOS ====================

// Obtener todos los productos activos
app.get('/api/productos', verifyToken, (req, res) => {
  const query = 'SELECT * FROM productos WHERE activo = TRUE ORDER BY nombre';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo productos:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Obtener producto por ID
app.get('/api/productos/:id', verifyToken, (req, res) => {
  const query = 'SELECT * FROM productos WHERE id = ? AND activo = TRUE';
  
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      console.error('Error obteniendo producto:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(results[0]);
  });
});

// Crear producto
app.post('/api/productos', verifyToken, (req, res) => {
  const { codigo, nombre, descripcion, precio_compra, precio_venta, stock, stock_minimo, categoria } = req.body;

  if (!codigo || !nombre || !precio_compra || !precio_venta || stock === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const query = `INSERT INTO productos (codigo, nombre, descripcion, precio_compra, precio_venta, stock, stock_minimo, categoria) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.query(query, [codigo, nombre, descripcion, precio_compra, precio_venta, stock, stock_minimo || 5, categoria], (err, result) => {
    if (err) {
      console.error('Error creando producto:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'El código del producto ya existe' });
      }
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    res.status(201).json({ 
      message: 'Producto creado exitosamente', 
      id: result.insertId 
    });
  });
});

// Actualizar producto
app.put('/api/productos/:id', verifyToken, (req, res) => {
  const { nombre, descripcion, precio_compra, precio_venta, stock, stock_minimo, categoria } = req.body;
  
  const query = `UPDATE productos 
                 SET nombre = ?, descripcion = ?, precio_compra = ?, precio_venta = ?, 
                     stock = ?, stock_minimo = ?, categoria = ?
                 WHERE id = ? AND activo = TRUE`;
  
  db.query(query, [nombre, descripcion, precio_compra, precio_venta, stock, stock_minimo, categoria, req.params.id], (err, result) => {
    if (err) {
      console.error('Error actualizando producto:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json({ message: 'Producto actualizado exitosamente' });
  });
});

// Eliminar producto (borrado lógico)
app.delete('/api/productos/:id', verifyToken, (req, res) => {
  const query = 'UPDATE productos SET activo = FALSE WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      console.error('Error eliminando producto:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json({ message: 'Producto eliminado exitosamente' });
  });
});

// ==================== RUTAS DE VENTAS ====================

// Crear venta
app.post('/api/ventas', verifyToken, (req, res) => {
  const { productos } = req.body; // Array de {producto_id, cantidad}
  
  if (!productos || productos.length === 0) {
    return res.status(400).json({ error: 'Debe agregar al menos un producto' });
  }

  // Iniciar transacción
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error iniciando transacción' });
    }

    // Generar folio único
    const folio = `V-${Date.now()}`;
    let total = 0;

    // Verificar stock y calcular total
    const productIds = productos.map(p => p.producto_id);
    const placeholders = productIds.map(() => '?').join(',');
    const queryProductos = `SELECT * FROM productos WHERE id IN (${placeholders}) AND activo = TRUE`;

    db.query(queryProductos, productIds, (err, productosDB) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({ error: 'Error verificando productos' });
        });
      }

      // Validar stock y calcular total
      for (const item of productos) {
        const producto = productosDB.find(p => p.id === item.producto_id);
        
        if (!producto) {
          return db.rollback(() => {
            res.status(400).json({ error: `Producto ${item.producto_id} no encontrado` });
          });
        }

        if (producto.stock < item.cantidad) {
          return db.rollback(() => {
            res.status(400).json({ 
              error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}` 
            });
          });
        }

        total += producto.precio_venta * item.cantidad;
      }

      // Insertar venta
      const queryVenta = 'INSERT INTO ventas (folio, total, usuario_id) VALUES (?, ?, ?)';
      
      db.query(queryVenta, [folio, total, req.user.id], (err, resultVenta) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ error: 'Error creando venta' });
          });
        }

        const ventaId = resultVenta.insertId;
        
        // Insertar detalles y actualizar stock
        let completedOperations = 0;
        const totalOperations = productos.length * 2; // detalles + updates

        productos.forEach(item => {
          const producto = productosDB.find(p => p.id === item.producto_id);
          const subtotal = producto.precio_venta * item.cantidad;

          // Insertar detalle
          const queryDetalle = `INSERT INTO detalle_ventas 
                               (venta_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) 
                               VALUES (?, ?, ?, ?, ?, ?)`;
          
          db.query(queryDetalle, 
            [ventaId, producto.id, producto.nombre, item.cantidad, producto.precio_venta, subtotal],
            (err) => {
              if (err) {
                return db.rollback(() => {
                  res.status(500).json({ error: 'Error insertando detalle de venta' });
                });
              }

              completedOperations++;

              // Actualizar stock
              const queryUpdateStock = 'UPDATE productos SET stock = stock - ? WHERE id = ?';
              
              db.query(queryUpdateStock, [item.cantidad, producto.id], (err) => {
                if (err) {
                  return db.rollback(() => {
                    res.status(500).json({ error: 'Error actualizando stock' });
                  });
                }

                completedOperations++;

                // Si todas las operaciones completaron, commit
                if (completedOperations === totalOperations) {
                  db.commit((err) => {
                    if (err) {
                      return db.rollback(() => {
                        res.status(500).json({ error: 'Error confirmando transacción' });
                      });
                    }

                    res.status(201).json({
                      message: 'Venta registrada exitosamente',
                      folio,
                      total,
                      venta_id: ventaId
                    });
                  });
                }
              });
            }
          );
        });
      });
    });
  });
});



// IMPORTANTE: Esta ruta debe estar ANTES de /api/ventas/:id
// Obtener ventas con filtro de fecha
app.get('/api/ventas/filtro', verifyToken, (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  
  let query = `SELECT v.*, u.nombre as vendedor 
               FROM ventas v 
               INNER JOIN usuarios u ON v.usuario_id = u.id`;
  
  const params = [];
  
  if (fecha_inicio && fecha_fin) {
    query += ` WHERE DATE(v.created_at) BETWEEN ? AND ?`;
    params.push(fecha_inicio, fecha_fin);
  } else if (fecha_inicio) {
    query += ` WHERE DATE(v.created_at) = ?`;
    params.push(fecha_inicio);
  }
  
  query += ` ORDER BY v.created_at DESC`;
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error obteniendo ventas filtradas:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Obtener todas las ventas
app.get('/api/ventas', verifyToken, (req, res) => {
  const query = `SELECT v.*, u.nombre as vendedor 
                 FROM ventas v 
                 INNER JOIN usuarios u ON v.usuario_id = u.id 
                 ORDER BY v.created_at DESC 
                 LIMIT 100`;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo ventas:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Obtener detalle de una venta
app.get('/api/ventas/:id', verifyToken, (req, res) => {
  const queryVenta = `SELECT v.*, u.nombre as vendedor 
                      FROM ventas v 
                      INNER JOIN usuarios u ON v.usuario_id = u.id 
                      WHERE v.id = ?`;
  
  const queryDetalle = 'SELECT * FROM detalle_ventas WHERE venta_id = ?';

  db.query(queryVenta, [req.params.id], (err, venta) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (venta.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    db.query(queryDetalle, [req.params.id], (err, detalles) => {
      if (err) {
        return res.status(500).json({ error: 'Error del servidor' });
      }

      res.json({
        ...venta[0],
        detalles
      });
    });
  });
});

// ==================== RUTAS DE REPORTES ====================

// Productos con stock bajo
app.get('/api/reportes/stock-bajo', verifyToken, (req, res) => {
  const query = 'SELECT * FROM vista_stock_bajo';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo stock bajo:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Productos más vendidos
app.get('/api/reportes/mas-vendidos', verifyToken, (req, res) => {
  const query = 'SELECT * FROM vista_productos_mas_vendidos LIMIT 10';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo productos más vendidos:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Ventas del día
app.get('/api/reportes/ventas-dia', verifyToken, (req, res) => {
  const query = `SELECT COUNT(*) as total_ventas, COALESCE(SUM(total), 0) as ingresos_totales
                 FROM ventas 
                 WHERE DATE(created_at) = CURDATE()`;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo ventas del día:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results[0]);
  });
});

// Ventas del mes
app.get('/api/reportes/ventas-mes', verifyToken, (req, res) => {
  const query = `SELECT COUNT(*) as total_ventas, COALESCE(SUM(total), 0) as ingresos_totales
                 FROM ventas 
                 WHERE MONTH(created_at) = MONTH(CURDATE()) 
                 AND YEAR(created_at) = YEAR(CURDATE())`;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo ventas del mes:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results[0]);
  });
});

// Dashboard completo
app.get('/api/reportes/dashboard', verifyToken, (req, res) => {
  const queries = {
    ventasDia: `SELECT COUNT(*) as total_ventas, COALESCE(SUM(total), 0) as ingresos_totales
                FROM ventas WHERE DATE(created_at) = CURDATE()`,
    
    ventasMes: `SELECT COUNT(*) as total_ventas, COALESCE(SUM(total), 0) as ingresos_totales
                FROM ventas WHERE MONTH(created_at) = MONTH(CURDATE()) 
                AND YEAR(created_at) = YEAR(CURDATE())`,
    
    stockBajo: 'SELECT COUNT(*) as total FROM vista_stock_bajo',
    
    productosActivos: 'SELECT COUNT(*) as total FROM productos WHERE activo = TRUE'
  };

  const results = {};
  let completedQueries = 0;

  Object.keys(queries).forEach(key => {
    db.query(queries[key], (err, result) => {
      if (err) {
        console.error(`Error en query ${key}:`, err);
        results[key] = { error: true };
      } else {
        results[key] = result[0];
      }

      completedQueries++;
      
      if (completedQueries === Object.keys(queries).length) {
        res.json(results);
      }
    });
  });
});

// ==================== RUTAS DE VENTAS CON FILTROS ====================

// Obtener ventas con filtro de fecha
app.get('/api/ventas/filtro', verifyToken, (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  
  let query = `SELECT v.*, u.nombre as vendedor 
               FROM ventas v 
               INNER JOIN usuarios u ON v.usuario_id = u.id`;
  
  const params = [];
  
  if (fecha_inicio && fecha_fin) {
    query += ` WHERE DATE(v.created_at) BETWEEN ? AND ?`;
    params.push(fecha_inicio, fecha_fin);
  } else if (fecha_inicio) {
    query += ` WHERE DATE(v.created_at) = ?`;
    params.push(fecha_inicio);
  }
  
  query += ` ORDER BY v.created_at DESC`;
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error obteniendo ventas filtradas:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Obtener productos vendidos en un rango de fechas
app.get('/api/reportes/productos-vendidos-fecha', verifyToken, (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  
  let query = `
    SELECT 
      dv.producto_id,
      dv.producto_nombre,
      SUM(dv.cantidad) as cantidad_vendida,
      SUM(dv.subtotal) as total_vendido,
      COUNT(DISTINCT v.id) as num_ventas
    FROM detalle_ventas dv
    INNER JOIN ventas v ON dv.venta_id = v.id
  `;
  
  const params = [];
  
  if (fecha_inicio && fecha_fin) {
    query += ` WHERE DATE(v.created_at) BETWEEN ? AND ?`;
    params.push(fecha_inicio, fecha_fin);
  } else if (fecha_inicio) {
    query += ` WHERE DATE(v.created_at) = ?`;
    params.push(fecha_inicio);
  }
  
  query += `
    GROUP BY dv.producto_id, dv.producto_nombre
    ORDER BY cantidad_vendida DESC
  `;
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error obteniendo productos vendidos:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

// Dashboard con filtro de fecha
app.get('/api/reportes/dashboard-filtrado', verifyToken, (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  
  const queries = {
    ventasPeriodo: {
      query: `SELECT COUNT(*) as total_ventas, COALESCE(SUM(total), 0) as ingresos_totales
              FROM ventas 
              WHERE DATE(created_at) BETWEEN ? AND ?`,
      params: [fecha_inicio || new Date().toISOString().split('T')[0], 
               fecha_fin || new Date().toISOString().split('T')[0]]
    },
    
    stockBajo: {
      query: 'SELECT COUNT(*) as total FROM vista_stock_bajo',
      params: []
    },
    
    productosActivos: {
      query: 'SELECT COUNT(*) as total FROM productos WHERE activo = TRUE',
      params: []
    }
  };

  const results = {};
  let completedQueries = 0;

  Object.keys(queries).forEach(key => {
    db.query(queries[key].query, queries[key].params, (err, result) => {
      if (err) {
        console.error(`Error en query ${key}:`, err);
        results[key] = { error: true };
      } else {
        results[key] = result[0];
      }

      completedQueries++;
      
      if (completedQueries === Object.keys(queries).length) {
        res.json(results);
      }
    });
  });
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
  
});
