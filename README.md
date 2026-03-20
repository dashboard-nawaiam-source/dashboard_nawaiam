# Finnegans API - Clean Architecture

API Express con Clean Architecture que trae datos de Finnegans.

## 🏗️ Estructura

```
src/
├── domain/                    # Entidades
│   └── entities/
├── application/               # Lógica de negocio
│   ├── services/
│   └── repositories/
├── infrastructure/            # Configuración e integraciones
│   ├── config/
│   └── http/
├── presentation/              # Endpoints
│   ├── controllers/
│   └── routes/
└── main.ts                   # Entrada
```

## 🚀 Setup

### 1. Instalar
```bash
npm install
```

### 2. Configurar
```bash
cp .env.example .env
# Edita .env con tu token
```

### 3. Ejecutar
```bash
npm run dev
```

## 📡 Endpoints

### Facturas
```bash
GET  /facturas
GET  /productos
GET  /vendedores
GET  /contratos
GET  /empresas
GET  /kpis
```

## 🏗️ Build

```bash
npm run build
npm start
```
