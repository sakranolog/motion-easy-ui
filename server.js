const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(bodyParser.json());

const instance = axios.create({
    baseURL: 'https://api.usemotion.com/v1',
    timeout: 10000,
    headers: {
        'X-API-Key': process.env.MOTION_API_KEY,
        'Content-Type': 'application/json',
    },
});

async function getWorkspaces() {
    try {
        console.log('Fetching workspaces...');
        const response = await instance.get('/workspaces');
        console.log('Workspaces fetched successfully');
        return response.data.workspaces;
    } catch (error) {
        console.error('Error fetching workspaces:', error.response ? error.response.data : error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        throw error;
    }
}

app.get('/list-workspaces', async (req, res) => {
    try {
        const workspaces = await getWorkspaces();
        const defaultWorkspaceId = await getDefaultWorkspace();
        console.log('Sending workspaces to client:', { workspaceCount: workspaces.length, defaultWorkspaceId });
        res.json({ workspaces, defaultWorkspaceId });
    } catch (error) {
        console.error('Error in /list-workspaces:', error.message);
        res.status(500).json({ message: 'Error fetching workspaces', error: error.message });
    }
});

app.post('/add-task', async (req, res) => {
    try {
        console.log('Received task data:', req.body);
        const taskData = {
            ...req.body,
            priority: req.body.priority || 'MEDIUM',
        };
        
        // Handle due date
        if (taskData.dueDate && taskData.dueDate.trim() !== '') {
            taskData.dueDate = new Date(taskData.dueDate).toISOString();
        } else {
            // Set a default due date 7 days from now if not provided
            const defaultDueDate = new Date();
            defaultDueDate.setDate(defaultDueDate.getDate() + 7);
            taskData.dueDate = defaultDueDate.toISOString();
        }

        // Handle auto-scheduling
        taskData.autoScheduled = {
            startDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
            deadlineType: taskData.deadlineType || 'SOFT',
            schedule: 'Work Hours'
        };

        // Handle duration - default to 30 minutes if not provided
        if (taskData.duration === 'NONE' || taskData.duration === 'REMINDER') {
            // Keep as is
        } else if (typeof taskData.duration === 'number' || !isNaN(parseInt(taskData.duration))) {
            taskData.duration = parseInt(taskData.duration, 10);
        } else {
            taskData.duration = 30; // Default to 30 minutes
        }

        // Remove unnecessary fields
        delete taskData.deadlineType; // We've moved this into autoScheduled

        // Remove empty fields
        Object.keys(taskData).forEach(key => 
            (taskData[key] === '' || taskData[key] == null) && delete taskData[key]
        );

        console.log('Sending task data to Motion API:', taskData);

        const response = await instance.post('/tasks', taskData);
        console.log('Task added successfully:', response.data);
        res.json({ message: 'Task added successfully', taskId: response.data.id });
    } catch (error) {
        console.error('Error adding task:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Error adding task', error: error.response ? error.response.data : error.message });
    }
});

async function getDefaultWorkspace() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'defaultWorkspace.json'), 'utf8');
        return JSON.parse(data).defaultWorkspaceId;
    } catch (error) {
        console.error('Error reading default workspace:', error.message);
        return null;
    }
}

app.post('/set-default-workspace', async (req, res) => {
    try {
        const { workspaceId } = req.body;
        console.log('Setting default workspace:', workspaceId);
        await fs.writeFile(path.join(__dirname, 'defaultWorkspace.json'), JSON.stringify({ defaultWorkspaceId: workspaceId }));
        res.json({ message: 'Default workspace set successfully' });
    } catch (error) {
        console.error('Error setting default workspace:', error.message);
        res.status(500).json({ message: 'Error setting default workspace', error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('API Key:', process.env.MOTION_API_KEY ? `Set (length: ${process.env.MOTION_API_KEY.length})` : 'Not set');
});