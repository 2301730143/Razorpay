const express = require('express');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const path = require('path');

const app = express();
const PORT = process.env.PORT || 7002;

app.use(express.json());
app.use(cookieParser());

// Serve the frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Route modules
const onboardingsRouter = require('./routes/onboardings');
const rolesRouter = require('./routes/roles');
const employeesRouter = require('./routes/employees');
const reimbursementsRouter = require('./routes/reimbursements');

app.use('/rest/onboardings', onboardingsRouter);
app.use('/rest/roles', rolesRouter);
app.use('/rest/employees', employeesRouter);
app.use('/rest/reimbursements', reimbursementsRouter);

// Catch-all: serve index.html for the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
