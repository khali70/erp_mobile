# Skill: Project Architecture

## Purpose

Ensure every generated feature follows the existing project structure.

## Project Structure

lib/
├── src/
│ ├── config/
│ ├── core/
│ └── features/

### Core Rules

Use:

- DioConsumer
- BaseRepositoryMixin
- Failure hierarchy
- Exception hierarchy
- GetIt
- GoRouter
- Cubit/BLoC

Never bypass architecture layers.

### Preferred Feature Structure

features/
└── feature_name/
├── data/
│ ├── datasources/
│ ├── models/
│ ├── mappers/
│ └── repositories/
│
├── domain/
│ ├── entities/
│ ├── repositories/
│ └── usecases/
│
└── presentation/
├── cubit/
├── pages/
└── widgets/
