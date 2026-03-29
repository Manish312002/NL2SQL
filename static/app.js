const API_BASE = 'http://localhost:8000';

const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('questionInput');
const sendBtn = document.getElementById('sendBtn');
const clearChat = document.getElementById('clearChat');
const healthStatus = document.getElementById('healthStatus');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

let isProcessing = false;

// =====================
// Initialization
// =====================
document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    setInterval(checkHealth, 30000);
    setupEventListeners();
    autoResizeTextarea();
});

// =====================
// Health Check
// =====================
async function checkHealth() {
    try {
        const resp = await fetch(`${API_BASE}/health`);
        const data = await resp.json();
        
        healthStatus.className = 'health-status connected';
        const memItems = data.agent_memory_items || 0;
        healthStatus.querySelector('span').textContent = `Connected · ${memItems} memory items`;
    } catch {
        healthStatus.className = 'health-status disconnected';
        healthStatus.querySelector('span').textContent = 'Disconnected';
    }
}

// =====================
// Event Listeners
// =====================
function setupEventListeners() {
    // Form submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSend();
    });

    // Input changes
    questionInput.addEventListener('input', () => {
        sendBtn.disabled = !questionInput.value.trim() || isProcessing;
        autoResizeTextarea();
    });

    // Enter to send (Shift+Enter for new line)
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Clear chat
    clearChat.addEventListener('click', () => {
        chatMessages.innerHTML = '';
        addWelcomeCard();
    });

    // Quick questions
    document.querySelectorAll('.quick-q').forEach(btn => {
        btn.addEventListener('click', () => {
            questionInput.value = btn.dataset.question;
            sendBtn.disabled = false;
            handleSend();
            sidebar.classList.remove('open');
        });
    });

    // Example tags
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('example-tag')) {
            questionInput.value = e.target.dataset.question;
            sendBtn.disabled = false;
            handleSend();
        }
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// =====================
// Auto-resize Textarea
// =====================
function autoResizeTextarea() {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
}



// =====================
// Handle Send
// =====================
async function handleSend() {
    const question = questionInput.value.trim();
    if (!question || isProcessing) return;

    // Remove welcome card if present
    const welcome = chatMessages.querySelector('.welcome-card');
    if (welcome) welcome.remove();

    // Add user message
    addMessage('user', question);

    questionInput.value = '';
    autoResizeTextarea();
    sendBtn.disabled = true;
    isProcessing = true;

    // Add loading indicator
    const loadingId = addLoading();

    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
            signal: controller.signal
        });

        removeLoading(loadingId);
        let data; 
        try { 
            data = await resp.json(); 
        } catch { 
            addErrorMessage("Invalid server response"); 
            return; 
        }


        if (!resp.ok) {
            addErrorMessage(data.detail || `Server error (${resp.status})`, question);
            return
        }
        
        if (!data.sql_query) { 
            addErrorMessage(data.message || "Unable to generate SQL"); 
            return; 
        }

        addResultMessage(data);

    } catch (err) {
        removeLoading(loadingId);
        if (err.name === 'AbortError') { 
            addErrorMessage("⏱️ Request timeout. Try again."); 
        } else { 
            addErrorMessage(`Connection failed: ${err.message}`); 
        }
    } finally {
        isProcessing = false;
        sendBtn.disabled = !questionInput.value.trim();
        questionInput.focus();
    }
}

// =====================
// Message Rendering
// =====================
function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-body">
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();
}

function addResultMessage(data) {
    const div = document.createElement('div');
    div.className = 'message assistant';

    const tabId = 'tab_' + Date.now();
    // Build chart section (shown prominently above tabs if available)
    const hasChart = data.columns && data.columns.length >= 2 && data.rows && data.rows.length > 0;
    const chartId = 'chart_' + Date.now();
    const selectId = 'select_' + Date.now();
    const csvBtnId = 'csv_' + Date.now();
    const copyBtnId = 'copy_' + Date.now();
    const pngBtnId = 'png_' + Date.now();

    const chartSection = hasChart ? `
        <div class="chart-section">
            <div class="chart-header">
                <div class="chart-controls" id="${selectId}">
                    <button class="chart-btn active" data-type="bar" title="Bar Chart">📊 Bar</button>
                    <button class="chart-btn" data-type="line" title="Line Chart">📈 Line</button>
                    <button class="chart-btn" data-type="pie" title="Pie Chart">🥧 Pie</button>
                    <button class="chart-btn" data-type="scatter" title="Scatter Plot">✨ Scatter</button>
                </div>
                <div>
                    <button class="action-btn" id="${pngBtnId}" title="Download Chart as PNG">📸 Export PNG</button>
                </div>
            </div>
            <div class="chart-container" id="${chartId}"></div>
        </div>
    ` : '';

    div.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-body">
            <div class="message-text">${escapeHtml(data.message || 'Query executed.')}</div>
            <div class="result-card">
                ${chartSection}
                <div class="result-tabs">
                    <button class="result-tab active" data-tab="${tabId}_data">📋 Data (${data.row_count})</button>
                    <button class="result-tab" data-tab="${tabId}_sql">🔍 SQL</button>
                </div>
                <div class="result-panel active" id="${tabId}_data">
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                        <button class="action-btn" id="${csvBtnId}">⬇️ Export CSV</button>
                    </div>
                    <div id="wrap_${tabId}">
                        ${renderTable(data.columns, data.rows, tabId)}
                    </div>
                </div>
                <div class="result-panel" id="${tabId}_sql">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Generated SQL Query</span>
                        <button class="action-btn" id="${copyBtnId}">📋 Copy SQL</button>
                    </div>
                    <div class="sql-display">
                        <pre>${highlightSQL(data.sql_query || 'N/A')}</pre>
                    </div>
                </div>
            </div>
        </div>
    `;

    chatMessages.appendChild(div);

    // Auto-render chart immediately if available
    if (hasChart) {
        setTimeout(() => {
            renderDynamicChart(chartId, data.columns, data.rows, 'bar');

            // Add listener to selector buttons
            const controlGroup = document.getElementById(selectId);
            if (controlGroup) {
                const btns = controlGroup.querySelectorAll('.chart-btn');
                btns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        btns.forEach(b => b.classList.remove('active'));
                        e.currentTarget.classList.add('active');
                        renderDynamicChart(chartId, data.columns, data.rows, e.currentTarget.dataset.type);
                    });
                });
            }
        }, 100);
    }

    // Setup Export & Copy buttons
    document.getElementById(csvBtnId)?.addEventListener('click', () => {
        downloadCSV(data.columns, data.rows, `nl2sql_export_${Date.now()}.csv`);
    });

    document.getElementById(copyBtnId)?.addEventListener('click', (e) => {
        copyToClipboard(data.sql_query || '', e.currentTarget);
    });

    document.getElementById(pngBtnId)?.addEventListener('click', async () => {
        const gd = document.getElementById(chartId);

        if (!gd || !gd.data) {
            console.error("Invalid Plotly chart instance");
            return;
        }

        try {
            const url = await Plotly.downloadImage(gd, {
                format: 'png',
                width: 1200,
                height: 800,
                filename: `chart_${Date.now()}`
            });

            console.log("Download triggered");

        } catch (err) {
            console.error("Download failed:", err);
        }
    });

    // Setup tab switching
    div.querySelectorAll('.result-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            div.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
            div.querySelectorAll('.result-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    scrollToBottom();
    // Scroll again after chart renders
    // if (hasChart) {
    //     setTimeout(scrollToBottom, 300);
    // }
}

function addErrorMessage(text, originalQuestion = '') {
    const div = document.createElement('div');
    div.className = 'message assistant';
    
    let friendlySuggestions = '';
    const errLower = text.toLowerCase();
    
    if (errLower.includes('no such column')) {
        friendlySuggestions = `<div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);">💡 <strong>Suggestion:</strong> The AI tried to use a column that doesn't exist. Try asking: <em>"What columns are in this table?"</em></div>`;
    } else if (errLower.includes('no such table')) {
        friendlySuggestions = `<div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);">💡 <strong>Suggestion:</strong> The AI guessed a wrong table name. Try asking: <em>"Can you list all the tables in the database?"</em></div>`;
    } else if (errLower.includes('dangerous sql') || errLower.includes('forbidden')) {
        friendlySuggestions = `<div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);">🛡️ <strong>Security Block:</strong> Only SELECT queries are allowed.</div>`;
    }

    div.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-body">
            <div class="error-message" style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--accent-red); padding: 12px; border-radius: 4px;">
                <div style="color: #fca5a5; font-weight: 500; margin-bottom: 4px;">⚠️ Error executing query</div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #f87171;">${escapeHtml(text)}</div>
                ${friendlySuggestions}
            </div>
            ${originalQuestion ? `
            <div style="margin-top: 12px;">
                <button class="action-btn" onclick="document.getElementById('questionInput').value='${escapeHtml(originalQuestion).replace(/'/g, "\\'")}'; document.getElementById('questionInput').focus();">🔄 Retry Question</button>
            </div>
            ` : ''}
        </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();
}

// ===================== 
// Loading 
// =====================

function addLoading() {
    const id = 'loading_' + Date.now();
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = id;

    div.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-body">
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(div);
    scrollToBottom();
    return id;
}

function removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function addWelcomeCard() {
    chatMessages.innerHTML = `
        <div class="welcome-card">
            <div class="welcome-icon">
                <svg viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="url(#grad1)"/>
                    <path d="M15 20h18M15 26h12M15 32h15" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="34" cy="14" r="6" fill="#6ee7b7"/>
                    <path d="M32 14l1.5 1.5L36 12" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                    <defs>
                        <linearGradient id="grad1" x1="0" y1="0" x2="48" y2="48">
                            <stop stop-color="#8b5cf6"/>
                            <stop offset="1" stop-color="#3b82f6"/>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <h2>Welcome to NL2SQL</h2>
            <p>Ask me anything about the clinic database in plain English. I'll convert your question to SQL, run it, and show you the results with charts.</p>
            <div class="welcome-examples">
                <span class="example-tag" data-question="Which doctor has the most appointments?">Most booked doctor</span>
                <span class="example-tag" data-question="Show patient registration trend by month">Registration trend</span>
                <span class="example-tag" data-question="Average treatment cost by specialization">Cost analysis</span>
                <span class="example-tag" data-question="Compare revenue between departments">Dept. comparison</span>
            </div>
        </div>
    `;
}

// =====================
// Table Rendering & Pagination
// =====================
window.tableStore = {};

function renderTable(columns, rows, tableId = null) {
    if (!columns || !rows || rows.length === 0) {
        return '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 8px 0;">No data returned.</p>';
    }

    if (!tableId) tableId = 'tbl_' + Date.now();
    
    // Initialize or get state
    if (!window.tableStore[tableId]) {
        window.tableStore[tableId] = { columns, rows, page: 1, pageSize: 15 };
    }

    return buildTableHTML(tableId);
}

function buildTableHTML(tableId) {
    const data = window.tableStore[tableId];
    if (!data) return '';
    
    const { columns, rows, page, pageSize } = data;
    const totalPages = Math.ceil(rows.length / pageSize);
    const startIdx = (page - 1) * pageSize;
    const displayRows = rows.slice(startIdx, startIdx + pageSize);

    let html = '<div class="data-table-wrapper"><table class="data-table"><thead><tr>';
    columns.forEach(col => html += `<th>${escapeHtml(String(col))}</th>`);
    html += '</tr></thead><tbody>';

    displayRows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            const val = cell === null ? '—' : cell;
            html += `<td>${escapeHtml(String(val))}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Pagination controls
    if (totalPages > 1) {
        html += `
        <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 0.8rem;">
            <span style="color: var(--text-muted);">Showing ${startIdx + 1}-${Math.min(startIdx + pageSize, rows.length)} of ${rows.length} rows</span>
            <div style="display: flex; gap: 8px;">
                <button class="action-btn" onclick="changeTablePage('${tableId}', ${page - 1})" ${page === 1 ? 'disabled' : ''}>⬅️ Prev</button>
                <span style="display:inline-flex; align-items:center; color: var(--text-primary);">Page ${page} / ${totalPages}</span>
                <button class="action-btn" onclick="changeTablePage('${tableId}', ${page + 1})" ${page === totalPages ? 'disabled' : ''}>Next ➡️</button>
            </div>
        </div>`;
    }

    return html;
}

window.changeTablePage = function(tableId, newPage) {
    const data = window.tableStore[tableId];
    if (!data) return;
    if (newPage >= 1 && newPage <= Math.ceil(data.rows.length / data.pageSize)) {
        data.page = newPage;
        const wrapper = document.getElementById(`wrap_${tableId}`);
        if (wrapper) {
            wrapper.innerHTML = buildTableHTML(tableId);
        }
    }
}

// =====================
// SQL Syntax Highlighting
// =====================
function highlightSQL(sql) {
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
        'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'AS',
        'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'CASE', 'WHEN',
        'THEN', 'ELSE', 'END', 'DESC', 'ASC', 'UNION', 'ALL', 'EXISTS',
        'STRFTIME', 'DATE', 'COALESCE', 'CAST', 'IFNULL'
    ];

    let escaped = escapeHtml(sql);

    // Highlight keywords
    keywords.forEach(kw => {
        const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
        escaped = escaped.replace(regex, '<span style="color: #c084fc;">$1</span>');
    });

    // Highlight strings
    escaped = escaped.replace(/&#39;([^&#]*(?:&#[^;]*;[^&#]*)*)&#39;/g, '<span style="color: #6ee7b7;">\'$1\'</span>');

    // Highlight numbers
    escaped = escaped.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #fcd34d;">$1</span>');

    return escaped;
}

// =====================
// Chart Rendering
// =====================
function renderDynamicChart(containerId, columns, rows, chartType) {
    try {
        const container = document.getElementById(containerId);
        if (!container || !columns || columns.length < 2 || !rows || rows.length === 0) return;

        // Try to identify numeric columns for Y axis
        let xColIndex = 0;
        let yColIndex = 1;

        const isNumeric = (val) => typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)));

        for (let i = 0; i < columns.length; i++) {
            if (rows.length > 0 && isNumeric(rows[0][i])) {
                yColIndex = i;
                xColIndex = i === 0 && columns.length > 1 ? 1 : 0;
                break; // Use the first numeric column we find
            }
        }

        let xData = rows.map(r => r[xColIndex]);
        let yData = rows.map(r => r[yColIndex]);

        // For pie charts, limit to top 15 rows to avoid crowding
        if (chartType === 'pie' && xData.length > 15) {
            xData = xData.slice(0, 15);
            yData = yData.slice(0, 15);
        }

        let trace = {};
        if (chartType === 'pie') {
            trace = {
                labels: xData,
                values: yData,
                type: 'pie',
                hole: 0.4,
                textinfo: 'label+percent',
                textposition: 'inside',
                marker: {
                    colors: ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#a855f7', '#14b8a6', '#f97316']
                }
            };
        } else {
            trace = {
                x: xData,
                y: yData,
                type: chartType === 'line' ? 'scatter' : chartType,
                mode: chartType === 'scatter' ? 'markers' : (chartType === 'line' ? 'lines+markers' : undefined),
                marker: {
                    color: '#8b5cf6',
                    opacity: 0.85,
                    size: chartType === 'scatter' || chartType === 'line' ? 8 : undefined
                },
                line: chartType === 'line' ? { color: '#8b5cf6', width: 3 } : undefined
            };
        }

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0.15)',
            font: { color: '#94a3b8', family: 'Inter, sans-serif', size: 12 },
            margin: { l: 60, r: 20, t: 30, b: 60 },
            xaxis: {
                title: chartType !== 'pie' ? escapeHtml(columns[xColIndex]) : '',
                gridcolor: 'rgba(139, 92, 246, 0.1)',
                linecolor: 'rgba(139, 92, 246, 0.2)',
                tickangle: -45,
            },
            yaxis: {
                title: chartType !== 'pie' ? escapeHtml(columns[yColIndex]) : '',
                gridcolor: 'rgba(139, 92, 246, 0.1)',
                linecolor: 'rgba(139, 92, 246, 0.2)',
            },
            showlegend: chartType === 'pie',
            legend: { font: { color: '#e2e8f0' } }
        };

        Plotly.newPlot(container, [trace], layout, {
            responsive: true,
            displayModeBar: false,
        });

    } catch (err) {
        console.error('Chart rendering error:', err);
    }
}

// =====================
// Utilities
// =====================
function escapeHtml(text) {
    const el = document.createElement('div');
    el.textContent = text;
    return el.innerHTML;
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// =====================
// Export & Copy Utils
// =====================
function downloadCSV(columns, rows, filename = "data.csv") {
    if (!columns || !rows || rows.length === 0) return;

    const sanitizeForExcel = (value) => {
        if (value === null || value === undefined) return "";
        let str = String(value);

        // Prevent Excel formula injection
        if (/^[=+\-@]/.test(str)) {
            str = "'" + str;
        }

        // Escape double quotes
        return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = [];

    // Add BOM
    csvRows.push("\uFEFF");

    // Header row
    csvRows.push(columns.map(col => sanitizeForExcel(col)).join(","));

    // Data rows
    rows.forEach(row => {
        const formattedRow = row.map(cell => sanitizeForExcel(cell)).join(",");
        csvRows.push(formattedRow);
    });

    const csvContent = csvRows.join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function copyToClipboard(text, btnElement) {
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for non-HTTPS connections (like viewing on mobile over LAN)
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }

        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = '✅ Copied!';
        setTimeout(() => btnElement.innerHTML = originalText, 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
        btnElement.innerHTML = '❌ Failed';
        setTimeout(() => btnElement.innerHTML = '📋 Copy SQL', 2000);
    }
}
