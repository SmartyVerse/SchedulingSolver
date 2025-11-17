let processes = [];
let processIdCounter = 1;

function addProcess(at = 0, bt = 5) {
    const tableBody = document.querySelector("#process-table tbody");
    const id = processIdCounter++;
    processes.push({ id: `P${id}`, AT: at, BT: bt });

    const newRow = tableBody.insertRow();
    newRow.innerHTML = `
        <td>P${id}</td>
        <td><input type="number" value="${at}" min="0" onchange="updateProcessData(${id}, 'AT', this.value)"></td>
        <td><input type="number" value="${bt}" min="1" onchange="updateProcessData(${id}, 'BT', this.value)"></td>
    `;
}

function updateProcessData(id, key, value) {
    const p = processes.find(p => p.id === `P${id}`);
    if (p) {
        p[key] = parseInt(value);
    }
}

function clearProcesses() {
    processes = [];
    processIdCounter = 1;
    document.querySelector("#process-table tbody").innerHTML = '';
    document.getElementById("result-section").classList.add("hidden");
}

function toggleQuantumInput() {
    const isRR = document.getElementById("algorithm").value === 'RR';
    document.getElementById("quantum-label").style.display = isRR ? 'inline' : 'none';
    document.getElementById("quantum").style.display = isRR ? 'inline' : 'none';
}

document.getElementById("algorithm").onchange = toggleQuantumInput;
addProcess(0, 8);
addProcess(1, 4);
addProcess(2, 9);
addProcess(3, 5);


function solveScheduling() {
    const algorithm = document.getElementById("algorithm").value;
    const quantum = parseInt(document.getElementById("quantum").value);
    
    const processesCopy = processes.map(p => ({
        ...p,
        initialBT: p.BT,
        remainingBT: p.BT,
        CT: 0,
        TAT: 0,
        WT: 0,
        RT: -1,
        arrivalTime: p.AT
    })).sort((a, b) => a.AT - b.AT);
    
    let results, gantt;

    switch (algorithm) {
        case 'FCFS':
            [results, gantt] = FCFS(processesCopy);
            break;
        case 'SJF_NonPreemptive':
            [results, gantt] = SJF_NonPreemptive(processesCopy);
            break;
        case 'SJF_Preemptive':
            [results, gantt] = SJF_Preemptive(processesCopy);
            break;
        case 'RR':
            if (isNaN(quantum) || quantum < 1) {
                alert("Please enter a valid quantum (time slice) for Round Robin.");
                return;
            }
            [results, gantt] = RoundRobin(processesCopy, quantum);
            break;
        default:
            return;
    }

    renderGanttChart(gantt);
    renderMetrics(results);
    renderAverages(results);
    document.getElementById("result-section").classList.remove("hidden");
}


function FCFS(procs) {
    let currentTime = 0;
    const ganttChart = [];

    for (const p of procs) {
        const startTime = Math.max(currentTime, p.AT);
        
        if (currentTime < startTime) {
            currentTime = startTime;
        }

        if (p.RT === -1) {
            p.RT = currentTime - p.AT;
        }

        const completionTime = currentTime + p.BT;
        
        ganttChart.push({ id: p.id, start: currentTime, end: completionTime });

        p.CT = completionTime;
        p.TAT = p.CT - p.AT;
        p.WT = p.TAT - p.initialBT;

        currentTime = completionTime;
    }
    return [procs, ganttChart];
}

function SJF_NonPreemptive(procs) {
    let currentTime = 0;
    const ganttChart = [];
    let completed = 0;
    const n = procs.length;

    while (completed !== n) {
        let min_bt = Infinity;
        let best_process_index = -1;

        for (let i = 0; i < n; i++) {
            const p = procs[i];
            if (p.AT <= currentTime && p.CT === 0) {
                if (p.BT < min_bt) {
                    min_bt = p.BT;
                    best_process_index = i;
                } else if (p.BT === min_bt && best_process_index !== -1 && procs[i].AT < procs[best_process_index].AT) {
                    best_process_index = i;
                }
            }
        }

        if (best_process_index === -1) {
            currentTime++;
        } else {
            const p = procs[best_process_index];
            const startTime = currentTime;
            
            if (p.RT === -1) {
                p.RT = startTime - p.AT;
            }

            const completionTime = startTime + p.BT;
            
            ganttChart.push({ id: p.id, start: startTime, end: completionTime });
            
            p.CT = completionTime;
            p.TAT = p.CT - p.AT;
            p.WT = p.TAT - p.initialBT;
            
            currentTime = completionTime;
            completed++;
        }
    }
    return [procs, ganttChart];
}

function SJF_Preemptive(procs) {
    let currentTime = 0;
    const ganttChart = [];
    let completed = 0;
    const n = procs.length;

    while (completed !== n) {
        let min_rem_bt = Infinity;
        let best_process_index = -1;

        for (let i = 0; i < n; i++) {
            const p = procs[i];
            if (p.AT <= currentTime && p.remainingBT > 0) {
                if (p.remainingBT < min_rem_bt) {
                    min_rem_bt = p.remainingBT;
                    best_process_index = i;
                }
            }
        }

        if (best_process_index === -1) {
            currentTime++;
        } else {
            const p = procs[best_process_index];
            const startTime = currentTime;

            if (p.RT === -1) {
                p.RT = startTime - p.AT;
            }
            
            const lastBlock = ganttChart[ganttChart.length - 1];
            if (lastBlock && lastBlock.id === p.id && lastBlock.end === currentTime) { 
                lastBlock.end++;
            } else {
                ganttChart.push({ id: p.id, start: currentTime, end: currentTime + 1 });
            }

            p.remainingBT--;
            currentTime++;

            if (p.remainingBT === 0) {
                p.CT = currentTime;
                p.TAT = p.CT - p.AT;
                p.WT = p.TAT - p.initialBT;
                completed++;
            }
        }
    }
    return [procs, ganttChart];
}

function RoundRobin(procs, quantum) {
    let currentTime = 0;
    const ganttChart = [];
    const queue = [];
    let completed = 0;
    const n = procs.length;

    const updateQueue = () => {
        procs.filter(p => p.AT <= currentTime && p.remainingBT > 0 && !queue.includes(p))
             .sort((a, b) => a.AT - b.AT)
             .forEach(p => queue.push(p));
    };

    updateQueue();

    while (completed !== n) {
        if (queue.length === 0) {
            currentTime++;
            updateQueue();
            continue;
        }

        const p = queue.shift();
        const executeTime = Math.min(quantum, p.remainingBT);
        const startTime = currentTime;

        if (p.RT === -1) {
            p.RT = startTime - p.AT;
        }

        const lastBlock = ganttChart[ganttChart.length - 1];
        if (lastBlock && lastBlock.id === p.id && lastBlock.end === startTime) { 
            lastBlock.end += executeTime;
        } else {
            ganttChart.push({ id: p.id, start: startTime, end: startTime + executeTime });
        }
        
        currentTime += executeTime;
        p.remainingBT -= executeTime;

        updateQueue();

        if (p.remainingBT > 0) {
            queue.push(p);
        } else {
            p.CT = currentTime;
            p.TAT = p.CT - p.AT;
            p.WT = p.TAT - p.initialBT;
            completed++;
        }
    }
    return [procs, ganttChart];
}


function renderGanttChart(gantt) {
    const ganttDiv = document.getElementById("gantt-chart");
    ganttDiv.innerHTML = '';
    
    const zeroTimeMarker = document.createElement('span');
    zeroTimeMarker.className = 'gantt-time';
    zeroTimeMarker.textContent = '0';
    zeroTimeMarker.style.left = '0px';
    ganttDiv.appendChild(zeroTimeMarker);

    if (gantt.length === 0) {
        ganttDiv.style.width = '100%'; 
        return;
    }

    const totalTime = gantt[gantt.length - 1].end;
    const scaleFactor = 30;

    ganttDiv.style.width = `${totalTime * scaleFactor + 50}px`;

    gantt.forEach(block => {
        const duration = block.end - block.start;
        const widthPx = duration * scaleFactor;
        
        const blockDiv = document.createElement('div');
        blockDiv.className = `gantt-block ${block.id}`;
        blockDiv.style.width = `${widthPx}px`;
        blockDiv.style.left = `${block.start * scaleFactor}px`;
        blockDiv.textContent = block.id;
        
        ganttDiv.appendChild(blockDiv);

        const endTimeMarker = document.createElement('span');
        endTimeMarker.className = 'gantt-time';
        endTimeMarker.textContent = block.end;
        endTimeMarker.style.left = `${block.end * scaleFactor}px`;
        ganttDiv.appendChild(endTimeMarker);
    });
}

function renderMetrics(results) {
    const tableBody = document.querySelector("#metrics-table tbody");
    tableBody.innerHTML = '';

    results.forEach(p => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.AT}</td>
            <td>${p.initialBT}</td>
            <td>${p.CT}</td>
            <td>${p.TAT}</td>
            <td>${p.WT}</td>
            <td>${p.RT}</td>
        `;
    });
}

function renderAverages(results) {
    const averagesDiv = document.getElementById("averages");
    if (results.length === 0) {
        averagesDiv.innerHTML = '';
        return;
    }

    const totalTAT = results.reduce((sum, p) => sum + p.TAT, 0);
    const totalWT = results.reduce((sum, p) => sum + p.WT, 0);
    const totalRT = results.reduce((sum, p) => sum + p.RT, 0);
    const count = results.length;

    const avgTAT = (totalTAT / count).toFixed(2);
    const avgWT = (totalWT / count).toFixed(2);
    const avgRT = (totalRT / count).toFixed(2);

    averagesDiv.innerHTML = `
        <p><strong>Average Turnaround Time (TAT):</strong> ${avgTAT}</p>
        <p><strong>Average Waiting Time (WT):</strong> ${avgWT}</p>
        <p><strong>Average Response Time (RT):</strong> ${avgRT}</p>
    `;
}
