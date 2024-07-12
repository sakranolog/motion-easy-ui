let workspaces = [];

function setDefaultDueDate() {
    const dueDateInput = document.getElementById('dueDate');
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);
    dueDateInput.value = defaultDueDate.toISOString().split('T')[0];
}

async function loadWorkspaces() {
    const resultDiv = document.getElementById('result');
    try {
        console.log('Fetching workspaces...');
        const response = await fetch('/list-workspaces');
        console.log('Response received:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Workspaces data:', data);
        workspaces = data.workspaces;
        const select = document.getElementById('workspaceSelect');
        select.innerHTML = workspaces.map(ws => `<option value="${ws.id}">${ws.name}</option>`).join('');
        
        if (data.defaultWorkspaceId) {
            select.value = data.defaultWorkspaceId;
        }

        // Enable the form once workspaces are loaded
        document.getElementById('taskForm').style.display = 'block';
        resultDiv.textContent = '';

        // Set default due date
        setDefaultDueDate();
    } catch (error) {
        console.error('Error loading workspaces:', error);
        resultDiv.textContent = `Error loading workspaces: ${error.message}. Please check the console for more details and try refreshing the page.`;
        resultDiv.style.color = 'red';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadWorkspaces();
    
    document.getElementById('setDefaultWorkspace').addEventListener('click', setDefaultWorkspace);
    document.getElementById('taskForm').addEventListener('submit', addTask);

    // Add event listeners for collapsible sections
    document.querySelectorAll('.collapsible-button').forEach(button => {
        button.addEventListener('click', function() {
            this.parentElement.classList.toggle('collapsed');
        });
    });

    document.getElementById('duration').addEventListener('change', function() {
        const customDurationInput = document.getElementById('customDuration');
        customDurationInput.style.display = this.value === 'custom' ? 'block' : 'none';
    });

    // Set default duration to 30 minutes
    document.getElementById('duration').value = '30';
});

async function setDefaultWorkspace() {
    const workspaceId = document.getElementById('workspaceSelect').value;
    try {
        const response = await fetch('/set-default-workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId }),
        });
        if (response.ok) {
            alert('Default workspace set successfully');
        } else {
            throw new Error('Failed to set default workspace');
        }
    } catch (error) {
        console.error('Error setting default workspace:', error);
        alert('Error setting default workspace');
    }
}

async function addTask(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const taskData = Object.fromEntries(formData);
    
    // Add workspaceId
    taskData.workspaceId = document.getElementById('workspaceSelect').value;

    // Handle autoScheduled
    taskData.autoScheduled = { 
        startDate: taskData.startDate || new Date().toISOString().split('T')[0],
        deadlineType: taskData.deadlineType
    };

    // Handle duration
    if (taskData.duration === 'custom' && taskData.customDuration) {
        taskData.duration = parseInt(taskData.customDuration, 10);
    } else {
        taskData.duration = parseInt(taskData.duration, 10);
    }
    delete taskData.customDuration;

    // Remove empty fields and fields that should be nested
    ['startDate', 'deadlineType'].forEach(key => delete taskData[key]);
    Object.keys(taskData).forEach(key => 
        (taskData[key] === '' || taskData[key] == null) && delete taskData[key]
    );

    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Adding task...';
    try {
        const response = await fetch('/add-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData),
        });
        const result = await response.json();
        if (response.ok) {
            resultDiv.textContent = result.message;
            resultDiv.style.color = 'green';
            e.target.reset();
            setDefaultDueDate(); // Reset the due date after successful submission
        } else {
            throw new Error(result.message || 'Error adding task');
        }
    } catch (error) {
        resultDiv.textContent = error.message;
        resultDiv.style.color = 'red';
    }
}