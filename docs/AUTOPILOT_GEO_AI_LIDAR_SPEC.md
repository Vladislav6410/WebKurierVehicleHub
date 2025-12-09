# WebKurier DroneAutopilot — Autopilot for Geodesy & Geology (AI + LiDAR Fusion)

Дата версии: 2025-12-09  
Фокус: геодезия, геология, лес, урбанистика, карьеры.  
Задача: реализовать автопилот и телеметрию, которые по функциям не уступают современным стекam (LP360, UgCS, Metashape, DroneDeploy, Correlator3D), но построены в архитектуре WebKurier.

---

## 1. Цели и сценарии

### 1.1. Основные цели

1. **AI-автоматизация миссий** — минимум ручной настройки, максимум автоматических режимов:
   - GSD-based высоты,
   - terrain-aware маршруты,
   - адаптивные паттерны для LiDAR/фото.

2. **LiDAR+Imagery Fusion** — одновременная работа с:
   - LiDAR point clouds,
   - RGB/обlique фото,
   - мультиспектральными/thermal датчиками,
   - с приоритетом на «пробивание» растительности и точность <1 см.

3. **Real-time Telemetry & QA/QC** — потоковая телеметрия, предварительный AI-анализ в полёте (NDVI, fault lines, biomass и т.п.).

4. **Совместимость с внешним ПО** (экспорт/импорт):
   - LANDXML, LAS/LAZ, GeoTIFF, DSM/DTM, DXF/Shape,
   - возможность выгружать данные в LP360, UgCS, Metashape, Correlator3D, DroneDeploy, ReCap.

5. **Интеграция с WebKurier**:
   - управление миссиями из WebKurierCore (веб),
   - телеметрия через Hybrid DevOps (Prometheus + Grafana),
   - модели AI регистрируются через MLOps-слой Hybrid (MLflow).

---

## 2. Архитектура автопилота (логические модули)

```text
DroneAutopilot/
  autopilot-core/        # Логика миссий и режимов
  telemetry-bridge/      # MAVLink/MAVSDK + RTK/PPK/IMU
  fusion-engine/         # AI-фьюжн LiDAR + фото/тепло/мультcпектр
  mission-planner/       # GSD-based планирование, terrain-aware
  workflows/             # Шаблоны пайплайнов (лес, урбанистика, mining)
  exporters/             # LANDXML, LAS/LAZ, GeoTIFF, BIM/AR-экспорт
  tests/                 # Интеграционные сценарии (симуляции)
  docs/                  # Спецификации, инструкции, примеры