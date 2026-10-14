# 🚘 TollFlow — Automatic Toll Collection & Vehicle Management System

TollFlow is a web-based **Automatic Toll Collection and Vehicle Management System** developed using **React, Django REST Framework, and SQLite**. The project simulates an automated toll collection process using RFID-based vehicle identification, wallet balance verification, toll deduction, and transaction tracking.

This project is developed as an academic project for the **Theory of Computation (TOC)** subject, demonstrating how a **Deterministic Finite Automaton (DFA)** can represent the sequence of events in a toll collection system.

## 📌 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Objectives](#-objectives)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [DFA Model](#-dfa-model)
- [Project Structure](#-project-structure)
- [Installation and Setup](#-installation-and-setup)
- [API Endpoints](#-api-endpoints)
- [Database and SQL](#-database-and-sql)
- [Testing](#-testing)
- [Limitations](#-limitations)
- [Future Enhancements](#-future-enhancements)
- [Academic Purpose](#-academic-purpose)
- [Author](#-author)

## 🚦 Overview

Traditional toll collection can involve manual processing and delays. TollFlow demonstrates how a software-based toll system can identify registered vehicles, verify their details, check wallet balances, and record toll transactions.

The application separates the frontend, backend, and database:

- **Frontend:** React provides the user interface.
- **Backend:** Django REST Framework handles authentication, business logic, and API requests.
- **Database:** SQLite stores application data.
- **Automaton:** A DFA represents the logical sequence of toll processing and rejection conditions.

> **Note:** RFID identification and gate opening are simulated in software. The project does not require a physical RFID reader or a real gate controller.

## 🎯 Problem Statement

Design an automaton representing the sequence:

**Vehicle Detection → RFID Verification → Payment Verification → Gate Opening → Vehicle Exit**

Vehicles with invalid RFID information, invalid registration, insufficient account balance, or failed payment must not be allowed to pass through the gate.

Sample RFID tags for demonstration:

- `RFID001`
- `RFID002`
- `RFID003`

## 🎯 Objectives

1. Develop a web-based vehicle and toll management system.
2. Allow users to register, log in, and manage registered vehicles.
3. Simulate RFID-based vehicle identification.
4. Verify wallet balance before completing toll processing.
5. Record successful and failed toll transactions.
6. Display wallet information and transaction history.
7. Demonstrate the toll workflow using a Deterministic Finite Automaton.
8. Use a relational database for persistent data storage.

## ✨ Features

The following describes the intended and previously reported functionality. Verify each feature in the current code before presenting it as completed.

- **User Authentication:** Registration and login.
- **Vehicle Management:** Register vehicles and view associated vehicle information.
- **Wallet Management:** View wallet balance and use a demo top-up feature.
- **Toll Plaza Management:** Retrieve available active toll plazas.
- **Toll Processing:** Submit a vehicle RFID tag and toll plaza for processing.
- **Balance Verification:** Reject toll passage when the available balance is insufficient.
- **Transaction History:** View recorded toll transactions and their outcomes.
- **Dashboard:** Display useful account and toll-related information.
- **DFA-Based Workflow:** Represent successful and rejected toll-processing paths.

The demo wallet top-up is not a real payment transaction. Physical RFID hardware and automatic gate control are outside the current software simulation unless separately integrated.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| JavaScript | Frontend application logic |
| HTML and CSS | Page structure and styling |
| Python | Backend programming language |
| Django | Backend web framework |
| Django REST Framework | REST API development |
| SQLite | Relational database |
| Django ORM | Database operations |
| Vite | Frontend development server |
| Git and GitHub | Version control and project hosting |

## 🏗️ System Architecture

```text
             USER
               |
               v
       REACT FRONTEND
        (Vite :5173)
               |
         HTTP / REST API
               |
               v
      DJANGO REST FRAMEWORK
        (Django :8000)
               |
       Business Logic and
       Toll Validation
               |
               v
        DJANGO ORM
               |
               v
         SQLITE DATABASE
           db.sqlite3
```

### How it works

1. The user interacts with the React frontend.
2. React sends an API request to the Django backend.
3. Django validates the request and executes the relevant business logic.
4. Django ORM reads or updates records in SQLite.
5. Django returns a response to the frontend.
6. React updates the interface with the result.

## 🤖 DFA Model

A Deterministic Finite Automaton is used to model the toll-processing sequence.

### States

| State | Description |
|---|---|
| `q0` | Ready; waiting for a vehicle |
| `q1` | Vehicle detected |
| `q2` | RFID verified |
| `q3` | Payment verified |
| `q4` | Gate opening or passage authorized |
| `q5` | Vehicle exited; accepting state |
| `qR` | Rejected; gate remains closed |

### Successful transition sequence

```text
q0 → q1 → q2 → q3 → q4 → q5
```

### Rejection conditions

The automaton transitions to `qR` if the RFID is invalid, the vehicle is not registered, the balance is insufficient, or payment fails.

```text
                  Invalid RFID
                       |
                       v
q0 → q1 → q2 → q3 → q4 → q5
       |      |      |
       |      |      |
       +------+------+
              |
              v
             qR
        Gate remains closed
```

The diagram is conceptual: actual transitions must be implemented and recorded by the backend if the application is to display a live DFA execution trace.

### Formal representation

A DFA is represented by the five-tuple:

**M = (Q, Σ, δ, q0, F)**

Where:

- `Q` = Set of states.
- `Σ` = Set of input symbols or events.
- `δ` = Transition function.
- `q0` = Initial state.
- `F` = Set of accepting states, here `{q5}`.

The input alphabet can include events such as `VEHICLE_DETECTED`, `RFID_VALID`, `RFID_INVALID`, `PAYMENT_SUFFICIENT`, `PAYMENT_INSUFFICIENT`, and `VEHICLE_EXITED`.

## 📁 Project Structure

The project uses separate folders for the Django backend and React frontend.

```text
Django2/
│
├── TollSystem/
│   ├── manage.py
│   ├── db.sqlite3
│   ├── TollSystem/
│   │   ├── settings.py
│   │   └── urls.py
│   │
│   └── Toll/
│       ├── models.py
│       ├── views.py
│       ├── serializers.py
│       ├── urls.py
│       └── migrations/
│
├── TollFrontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── services/
│       │   └── api.js
│       ├── components/
│       └── ...
│
└── README.md
```

This is an illustrative structure. Adjust it to match the actual folders and files in your repository.

## 🚀 Installation and Setup

### Prerequisites

Install the following before running the project:

- Python 3
- Node.js and npm
- Git
- A code editor such as Visual Studio Code

### 1. Clone the repository

Replace the example URL with your actual GitHub repository URL.

```bash
git clone https://github.com/YOUR_USERNAME/TollFlow.git
cd TollFlow
```

If your repository contains separate `TollSystem` and `TollFrontend` folders, follow the commands below from their respective directories.

### 2. Set up the Django backend

Open a terminal in the Django backend directory:

```bash
cd TollSystem
```

Create a virtual environment if one does not already exist:

```bash
python -m venv .venv
```

Activate it on Windows:

```powershell
..\.venv\Scripts\Activate.ps1
```

If the virtual environment is located outside the backend directory, use its actual path instead.

Install the backend dependencies:

```bash
pip install django djangorestframework django-cors-headers
```

If the project has a `requirements.txt`, prefer installing its pinned dependencies:

```bash
pip install -r requirements.txt
```

Apply database migrations:

```bash
python manage.py migrate
```

Check the Django configuration:

```bash
python manage.py check
```

Start the backend:

```bash
python manage.py runserver
```

The backend should be available at:

`http://127.0.0.1:8000/`

### 3. Set up the React frontend

Open a second terminal and navigate to the frontend directory:

```bash
cd TollFrontend
```

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Open the local frontend URL shown in the terminal, commonly:

`http://localhost:5173/`

Keep both development servers running while using the application.

### 4. Database setup

Django uses SQLite for local development. Run the following commands whenever model changes require new migrations:

```bash
python manage.py makemigrations
python manage.py migrate
```

If you want to create a Django administrator account and the project has the standard admin interface enabled:

```bash
python manage.py createsuperuser
```

## 🔌 API Endpoints

These are the expected endpoints based on the project implementation described during development. Confirm the routes in your current Django URL configuration before relying on this table.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/register/` | Register a user |
| POST | `/api/login/` | Log in |
| GET / POST | `/api/vehicles/` | List or register vehicles |
| GET | `/api/wallet/` | Retrieve wallet information |
| POST | `/api/wallet/demo-topup/` | Add demo wallet funds |
| GET | `/api/toll/plazas/` | Retrieve active toll plazas |
| POST | `/api/toll/process/` | Process a toll request |
| GET | `/api/transactions/` | Retrieve transaction history |

Authenticated endpoints may require a token in the request header:

```http
Authorization: Token YOUR_AUTH_TOKEN
```

Example toll-processing request:

```json
{
  "rfid_tag": "RFID001",
  "toll_plaza_id": 1
}
```

The actual response depends on the backend implementation and the vehicle, plaza, and wallet records in the database.

## 🗄️ Database and SQL

SQLite is the relational database used for local development.

Django models define the structure of database records, and Django migrations create or update the corresponding database tables.

Potential stored data includes:

- User accounts and profiles
- Registered vehicles and RFID tags
- Wallet balances
- Toll plaza details
- Toll rules
- Toll transaction records

Most application database operations use the Django ORM rather than manually written SQL.

Example ORM query:

```python
from Toll.models import Vehicle

vehicles = Vehicle.objects.all()
```

The database file is typically named `db.sqlite3` and located in the Django project root. Confirm its location in your settings.

## 🧪 Testing

Run Django's system checks:

```bash
python manage.py check
```

Run the backend tests:

```bash
python manage.py test Toll
```

If tests have not been written yet, Django may report that no tests were found. Add and run tests for the important scenarios:

- Valid RFID and sufficient wallet balance
- Invalid RFID tag
- Vehicle not registered
- Insufficient wallet balance
- Successful toll deduction
- Failed transaction handling
- Access to another user's vehicle or transaction data

Verify that rejected toll requests never authorize passage or deduct funds incorrectly.

## ⚠️ Limitations

- RFID detection is simulated through software input unless physical hardware is integrated.
- Gate opening is a logical state, not a physical gate operation.
- Demo wallet top-up does not process real money.
- SQLite is suitable for local development and demonstrations but may not be ideal for a high-concurrency production deployment.
- A complete live DFA trace requires backend support for exposing or recording actual state transitions.

## 🔮 Future Enhancements

- Integrate physical RFID readers.
- Add a hardware-controlled gate with appropriate safety mechanisms.
- Integrate a secure payment gateway.
- Add toll receipts and downloadable transaction reports.
- Add an administrator dashboard and toll-rule management.
- Introduce automated tests and continuous integration.
- Deploy the frontend and backend to production hosting.
- Evaluate PostgreSQL for multi-user production workloads.

## 🎓 Academic Purpose

This project demonstrates the application of **Theory of Computation**, particularly Deterministic Finite Automata, to a real-world-inspired toll collection workflow.

The DFA defines valid processing sequences and rejection conditions, while Django implements the business logic and SQLite stores persistent data.

## 👨‍💻 Author

**Project:** TollFlow — Automatic Toll Collection & Vehicle Management System

**Developed for:** Academic project — Theory of Computation (TOC)

**Author:** YOUR NAME

**College:** YOUR COLLEGE NAME

**GitHub:** YOUR_GITHUB_PROFILE_URL

---

*Replace the placeholders, confirm the endpoint paths, and update the feature list to match your final implementation before submitting the repository.*
