# Razorpay Reimbursements Backend

A role-based access control (RBAC) backend for managing employee reimbursements with multi-level approval workflows.

## 📋 Overview

This is a backend service for a reimbursements management tool built for partner organizations. The system implements strict role-based access control to manage who can see what data and who can perform which actions.

**Key Features:**
- Role-based access control (RBAC) for 4 distinct roles
- Multi-level reimbursement approval workflow
- Cookie-based authentication
- PostgreSQL database integration
- Clean separation of concerns with modular architecture

### Technology Stack

- **Language:** JavaScript (CommonJS)
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Authentication:** Cookie-based (JWT tokens)
- **Password Hashing:** bcryptjs
- **Node Version:** >= 20.10.2

### Repository Statistics

- **HTML:** 51.1%
- **JavaScript:** 48.9%

---

## 🎯 Core Concepts

### Roles & Responsibilities

| Role | Code | Responsibilities |
|------|------|------------------|
| **Employee** | `EMP` | Default role for all new accounts. Can create reimbursements for personal approval. |
| **Reporting Manager** | `RM` | Manages a team of employees. Reviews and approves/rejects employee reimbursements. |
| **Accounts Payable Executive** | `APE` | Handles payable-side approvals. Reviews reimbursements already approved by RMs. |
| **Chief Financial Officer** | `CFO` | Root user. Full system access. Manages role assignments and organizational structure. |

### Reimbursement Approval Workflow

```
EMP creates PENDING reimbursement
         ↓
RM reviews & approves/rejects
         ↓
APE reviews & approves/rejects
         ↓
Status changes to APPROVED or REJECTED
```

**Important:** A reimbursement is marked as `APPROVED` in the employee's view **only after** both the RM and at least one APE have approved it.

### Organization Structure

- Each employee reports to exactly one Reporting Manager
- Each RM manages a group of employees
- No direct relationships exist between EMP-APE, RM-APE, or APE-CFO

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.10.2
- PostgreSQL (preferred) or any SQL database
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Razorpay/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the `backend` directory:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=reimbursements_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   PORT=7002
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Seed the CFO account:**
   ```bash
   npm run db:seed-data
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:7002`

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── app.js                 # Express app setup & route configuration
│   ├── db/
│   │   ├── migrate.js         # Database migration script
│   │   ├── seed.js            # CFO seed data script
│   │   └── migrations/        # Migration files
│   ├── middleware/
│   │   └── auth.js            # Authentication & authorization middleware
│   ├── routes/
│   │   ├── onboardings.js     # Registration & login endpoints
│   │   ├── roles.js           # Role assignment endpoints
│   │   ├── employees.js       # Employee management endpoints
│   │   └── reimbursements.js  # Reimbursement endpoints
│   └── services/              # Business logic layer
│       ├── authService.js
│       ├── roleService.js
│       ├── employeeService.js
│       └── reimbursementService.js
├── package.json
└── README.md
```

---

## 🔐 Authentication & Authorization

### Authentication Flow

1. User registers or logs in via `/rest/onboardings/register` or `/rest/onboardings/login`
2. Server validates credentials and sets an HTTP-only cookie
3. Protected endpoints automatically extract and validate the cookie
4. Session management via JWT tokens stored in cookies

### CFO Credentials (Seeded)

```
Email:    cfo@org.com
Password: CFO#ORG@April2026
```

### Email Domain Restriction

- Only `@org.com` domain emails are allowed during registration
- Prevents unauthorized account creation

---

## 📡 API Specification

All endpoints are prefixed with `/rest`

### Public Endpoints

#### `POST /rest/onboardings/register`
Self-service registration. Creates an account with the default EMP role.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@org.com",
  "password": "secure_password_123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "uuid",
    "name": "John Doe",
    "email": "john@org.com",
    "role": "EMP"
  }
}
```

---

#### `POST /rest/onboardings/login`
Authenticate and create a session.

**Request:**
```json
{
  "email": "john@org.com",
  "password": "secure_password_123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "uuid",
    "email": "john@org.com",
    "role": "EMP"
  }
}
```

---

#### `POST /rest/onboardings/logout`
Logout and clear the session cookie.

**Request:** No payload (uses authenticated session)

**Response:**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

### Protected Endpoints

#### `POST /rest/roles/assign`
Assign a role to a user.

**Access:** CFO only

**Request:**
```json
{
  "userId": "target-user-id",
  "role": "RM"  // or APE, EMP, CFO
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "target-user-id",
    "role": "RM"
  }
}
```

---

#### `GET /rest/employees`
List employees based on role-based visibility.

**Access:** RM, APE, CFO (EMP role cannot access)

**Visibility Rules:**
- **RM:** See only their direct reports (EMPs)
- **APE:** See all EMPs and RMs
- **CFO:** See all users

**Response:**
```json
{
  "status": "success",
  "data": {
    "users": [
      {
        "userId": "uuid",
        "name": "Employee Name",
        "email": "employee@org.com",
        "role": "EMP"
      }
    ]
  }
}
```

---

#### `POST /rest/employees/assign`
Assign an employee to a reporting manager.

**Access:** CFO only

**Request:**
```json
{
  "userId": "employee-uuid",
  "reportingManagerId": "rm-uuid"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Employee assigned to reporting manager"
}
```

---

#### `DELETE /rest/employees/assign`
Remove employee-manager assignment.

**Access:** CFO only

**Request:**
```json
{
  "userId": "employee-uuid",
  "reportingManagerId": "rm-uuid"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Assignment removed"
}
```

---

#### `POST /rest/reimbursements`
Create a new reimbursement request.

**Access:** EMP only

**Request:**
```json
{
  "title": "Office Supplies",
  "description": "Purchased ink cartridges and notepads",
  "amount": 1500
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "reimbursementId": "uuid",
    "title": "Office Supplies",
    "description": "Purchased ink cartridges and notepads",
    "amount": 1500,
    "status": "PENDING",
    "createdBy": "employee-uuid",
    "createdAt": "2026-06-29T10:00:00Z"
  }
}
```

---

#### `PATCH /rest/reimbursements`
Update reimbursement status (approve/reject).

**Access:** RM, APE, CFO

**Request:**
```json
{
  "reimbursementId": "uuid",
  "status": "APPROVED"  // or REJECTED
}
```

**Request Validation:**
- **EMP:** Cannot edit reimbursements (read-only)
- **RM:** Can approve/reject
- **APE:** Can approve/reject
- **CFO:** Can approve/reject

**Response:**
```json
{
  "status": "success",
  "data": {
    "reimbursementId": "uuid",
    "status": "APPROVED"
  }
}
```

---

#### `GET /rest/reimbursements`
List reimbursements based on role-based visibility.

**Visibility Rules:**
- **EMP:** See only their own reimbursements
- **RM:** See PENDING reimbursements from their direct reports
- **APE:** See reimbursements PENDING at APE level (already RM-approved)
- **CFO:** See all APPROVED reimbursements

**Response:**
```json
{
  "status": "success",
  "data": {
    "reimbursements": [
      {
        "reimbursementId": "uuid",
        "title": "Office Supplies",
        "description": "Purchased ink cartridges and notepads",
        "amount": 1500,
        "status": "PENDING",
        "createdBy": "employee-uuid",
        "createdAt": "2026-06-29T10:00:00Z"
      }
    ]
  }
}
```

---

#### `GET /rest/reimbursements/<user-id>`
Get all reimbursements for a specific employee.

**Access:** RM can view reimbursements of their direct reports; CFO can view anyone's

**Response:**
```json
{
  "status": "success",
  "data": {
    "reimbursements": [
      {
        "reimbursementId": "uuid",
        "title": "Office Supplies",
        "description": "Purchased ink cartridges and notepads",
        "amount": 1500,
        "status": "APPROVED",
        "createdBy": "employee-uuid",
        "createdAt": "2026-06-29T10:00:00Z"
      }
    ]
  }
}
```

---

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'EMP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Employee-Manager Relationships
```sql
CREATE TABLE employee_manager (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id),
  manager_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id)
);
```

### Reimbursements Table
```sql
CREATE TABLE reimbursements (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Approvals Tracking
```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  reimbursement_id UUID NOT NULL REFERENCES reimbursements(id),
  approver_id UUID NOT NULL REFERENCES users(id),
  approver_role VARCHAR(50) NOT NULL,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Testing

The application exposes these npm scripts for testing:

```bash
# Start development server
npm run dev

# Run database migrations
npm run db:migrate

# Seed CFO account
npm run db:seed-data

# Run tests (if implemented)
npm test
```

---

## 🏗️ Architecture & Design Principles

### Separation of Concerns
- **Routes:** HTTP request handling and validation
- **Services:** Business logic and domain operations
- **Middleware:** Authentication, authorization, and request processing
- **Database:** Data persistence and queries

### SOLID Principles Applied

1. **Single Responsibility:** Each module has one reason to change
2. **Open/Closed:** Extensible via service layer without modifying routes
3. **Liskov Substitution:** Consistent error handling and response formats
4. **Interface Segregation:** Minimal dependencies between modules
5. **Dependency Inversion:** Services depend on abstractions, not concrete implementations

### Security Considerations

- Passwords hashed using bcryptjs (10 rounds)
- HTTP-only cookies for session management
- Email domain validation (org.com only)
- Role-based access control on all protected endpoints
- Input validation on all request payloads

---

## 📝 Development Notes

### Key Implementation Details

1. **Authentication:** JWT tokens stored in HTTP-only cookies
2. **Authorization:** Middleware checks role-based permissions before processing requests
3. **Reimbursement Status Logic:**
   - Reimbursement shows as APPROVED only when BOTH RM and APE approve
   - Rejection by either party marks it as REJECTED
4. **Data Visibility:** Each role sees only data they're authorized to access

### Common Error Responses

```json
{
  "status": "error",
  "message": "Unauthorized access",
  "code": "UNAUTHORIZED"
}
```

```json
{
  "status": "error",
  "message": "Resource not found",
  "code": "NOT_FOUND"
}
```

```json
{
  "status": "error",
  "message": "Invalid request payload",
  "code": "VALIDATION_ERROR"
}
```

---

## 🔄 Workflow Example

### Typical Reimbursement Workflow

1. **Employee (John)** creates a reimbursement: `POST /rest/reimbursements`
   - Status: `PENDING`

2. **Reporting Manager (Alice)** views pending reimbursements: `GET /rest/reimbursements`
   - Sees John's reimbursement

3. **Manager (Alice)** approves: `PATCH /rest/reimbursements`
   - Status: `PENDING` (awaiting APE approval)

4. **APE (Bob)** views pending reimbursements: `GET /rest/reimbursements`
   - Sees reimbursements RM-approved but pending APE approval

5. **APE (Bob)** approves: `PATCH /rest/reimbursements`
   - Status: `APPROVED` (final approval)

6. **Employee (John)** checks status: `GET /rest/reimbursements`
   - Now shows `APPROVED`

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)

---

## 📄 License

This project is part of the Razorpay Engineering Hiring Assignment.

---

## ✅ Submission Checklist

- [x] Express.js backend implementation
- [x] PostgreSQL database integration
- [x] Role-based access control (4 roles)
- [x] Multi-level reimbursement approval workflow
- [x] Cookie-based authentication
- [x] Clean, modular code architecture
- [x] Comprehensive API specification adherence
- [x] npm scripts: `dev`, `db:migrate`, `db:seed-data`
- [x] Port 7002 configuration
- [x] Node >= 20.10.2 support

---

**For inquiries or support, refer to the Razorpay Engineering Team.**
