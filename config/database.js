// config/database.js
// EDITA AQUÍ TUS CREDENCIALES DE BASE DE DATOS
require('dotenv').config();
const mysql = require('mysql2');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ferreteria_db',
  // Configuraciones adicionales para producción
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    console.error('Host:', dbConfig.host);
    console.error('Usuario:', dbConfig.user);
    console.error('Base de datos:', dbConfig.database);
    process.exit(1);
  }
  console.log('✅ Conectado a MySQL exitosamente');
});

module.exports = connection;
