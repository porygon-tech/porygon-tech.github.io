// Create a network container
const container = document.getElementById('mynetwork');


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to generate random nodes
function generateRandomNodes(numNodes) {
  const nodes = [];
  for (let i = 1; i <= numNodes; i++) {
    nodes.push({ id: i, label: `N ${i}` });
  }
  return nodes;
}

// Function to generate random edges
function generateRandomEdges(nodes) {
  const edges = [];
  const numNodes = nodes.length;
  for (let i = 0; i < numNodes; i++) {
    const fromNode = nodes[i].id;
    for (let j = i + 1; j < numNodes; j++) {
      const toNode = nodes[j].id;
      if (Math.random() < 0.5) {
        edges.push({ from: fromNode, to: toNode });
      }
    }
  }
  return edges;
}


// Generate a random initial network
let nodesData = generateRandomNodes(Math.random()*5+5); 
let edgesData = generateRandomEdges(nodesData);

// Create a data object
const data = {
  nodes: new vis.DataSet(nodesData),
  edges: new vis.DataSet(edgesData)
};

// Set the options for the network visualization
const options = {
    manipulation: {
        enabled: false
    },
    interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        multiselect: true,
        hover: true,
        navigationButtons: false
    },
    physics: {
        barnesHut: {
            damping: 0.2,
            maxVelocity:40,
            springConstant: 0.07
        }
      

    },
    nodes: {
        color: {
            background: 'gray',
            border: 'black',
            highlight: {
                background: 'orangered',
                border: 'white',
            }
        },
            font: {
      color: 'white',
      face: 'Arial',
      size: 14,
      bold: {
        color: 'white',
        face: 'Arial',
        size: 14,
        vadjust: -10,
        mod: 'bold',
      },
    },
    },
    edges:{
        smooth: {
            enabled: true,
            type: "dynamic",
            roundness: 0.5
        },
    }
};

// Create a network
const network = new vis.Network(container, data, options);

// Array to track available IDs
let availableIds = [];

// Add Node Button
const addNodeButton = document.createElement('button');
addNodeButton.textContent = 'Add Node';
addNodeButton.addEventListener('click', () => {
    const selectedNodes = network.getSelectedNodes();
    let fromNode = 1; // Default to Node 1 if no node is selected
    if (selectedNodes.length > 0) {
        fromNode = selectedNodes[0];
    }
      let newNodeId;
      if (availableIds.length > 0) {
        newNodeId = availableIds.pop();
      } else {
        newNodeId = nodesData.length + 1;
      }
    //const newNodeLabel = `Node ${newNodeId}`;
    const newNodeLabel = `N ${newNodeId}`;
    const newNode = { id: newNodeId, label: newNodeLabel };
    nodesData.push(newNode);
    data.nodes.add(newNode);
    for (var i = selectedNodes.length - 1; i >= 0; i--) {
        fromNode = selectedNodes[i]
        const newLink = { from: fromNode, to: newNodeId };
        edgesData.push(newLink);
        data.edges.add(newLink);
    }
});

// Remove Node Button
const removeNodeButton = document.createElement('button');
removeNodeButton.textContent = 'Remove Node';
removeNodeButton.addEventListener('click', () => {
  const selectedNodes = network.getSelectedNodes();
  if (selectedNodes.length > 0) {
    data.nodes.remove(selectedNodes);
    availableIds = availableIds.concat(selectedNodes.map((id) => parseInt(id)));
    const connectedEdges = data.edges.get({
      filter: (edge) =>
        selectedNodes.includes(edge.from) || selectedNodes.includes(edge.to),
    });
    data.edges.remove(connectedEdges);
  }
});

// Remove Link Button
const removeLinkButton = document.createElement('button');
removeLinkButton.textContent = 'Remove Link';
removeLinkButton.addEventListener('click', () => {
  const selectedEdges = network.getSelectedEdges();
  if (selectedEdges.length > 0) {
    data.edges.remove(selectedEdges);
  }
});

// Randomize Network Button
const randomizeNetworkButton = document.createElement('button');
randomizeNetworkButton.textContent = 'Randomize Network';
randomizeNetworkButton.addEventListener('click', () => {
  const nodeCount = nodesData.length;
  const edgeCount = Math.floor(nodeCount * (nodeCount - 1) / 4);
  const edges = new Set();
  while (edges.size < edgeCount) {
    const from = Math.floor(Math.random() * nodeCount) + 1;
    const to = Math.floor(Math.random() * nodeCount) + 1;
    if (from !== to) {
      edges.add(from < to ? `${from}-${to}` : `${to}-${from}`);
    }
  }
  data.edges.clear();
  edges.forEach((edge) => {
    const [from, to] = edge.split('-');
    data.edges.add({ from: parseInt(from), to: parseInt(to) });
  });
  adjacencyMatrixWidget.value = getAdjacencyMatrix();
});


// Node Selection Widget
const nodeSelectionWidget = document.createElement('div');
nodeSelectionWidget.className = 'node-selection-widget';

const nodeInput1 = document.createElement('input');
nodeInput1.type = 'text';
nodeInput1.placeholder = 'Node 1 ID';

const nodeInput2 = document.createElement('input');
nodeInput2.type = 'text';
nodeInput2.placeholder = 'Node 2 ID';

const createLinkButton = document.createElement('button');
createLinkButton.textContent = 'Create Link';
createLinkButton.addEventListener('click', () => {
    const node1 = parseInt(nodeInput1.value);
    const node2 = parseInt(nodeInput2.value);
    if (Number.isInteger(node1) && Number.isInteger(node2)) {
        const newLink = { from: node1, to: node2 };
        edgesData.push(newLink);
        data.edges.add(newLink);
        nodeInput1.value = '';
        nodeInput2.value = '';
    } else {
        alert('Please enter valid node IDs.');
    }
});

// Add Link Button
const addLinkButton = document.createElement('button');
addLinkButton.textContent = 'Add Link';
addLinkButton.addEventListener('click', () => {
    const selectedNodes = network.getSelectedNodes();
    if (selectedNodes.length === 2) {
        const [fromNode, toNode] = selectedNodes;
        const newLink = { from: fromNode, to: toNode };
        edgesData.push(newLink);
        data.edges.add(newLink);
    } else {
        alert('Please select two nodes to create a link.');
    }
});
//nodeSelectionWidget.appendChild(nodeInput1);
//nodeSelectionWidget.appendChild(nodeInput2);
//nodeSelectionWidget.appendChild(createLinkButton);
//nodeSelectionWidget.appendChild(addLinkButton);


// Physics Checkbox
const physicsCheckbox = document.createElement('input');
physicsCheckbox.type = 'checkbox';
physicsCheckbox.checked = true;
physicsCheckbox.addEventListener('change', () => {
  options.physics.enabled = physicsCheckbox.checked;
  network.setOptions(options);
});

const physicsLabel = document.createElement('label');
physicsLabel.textContent = 'Physics';
physicsLabel.appendChild(physicsCheckbox);

// Gravity Slider
const gravitySlider = document.createElement('input');
gravitySlider.type = 'range';
gravitySlider.min = -5000;
gravitySlider.max = 0;
gravitySlider.step = 100;
gravitySlider.value = options.physics.barnesHut.gravitationalConstant;
gravitySlider.addEventListener('input', () => {
  options.physics.barnesHut.gravitationalConstant = parseInt(gravitySlider.value);
  network.setOptions(options);
});

const gravityLabel = document.createElement('label');
gravityLabel.textContent = 'Gravity';
gravityLabel.appendChild(gravitySlider);

// Toolbox Container
const toolbox = document.createElement('div');
toolbox.className = 'toolbox';
//toolbox.style.position = 'absolute';
toolbox.style.left = '40px';
toolbox.style.top = '140px';


toolbox.appendChild(addNodeButton);
toolbox.appendChild(addLinkButton);
toolbox.appendChild(removeNodeButton);
toolbox.appendChild(removeLinkButton);
toolbox.appendChild(randomizeNetworkButton);
toolbox.appendChild(physicsLabel);
toolbox.appendChild(gravityLabel);





// Adjacency Matrix Widget
const adjacencyMatrixWidget = document.createElement('textarea');
adjacencyMatrixWidget.className = 'adjacency-matrix-widget';
adjacencyMatrixWidget.rows = 5;
adjacencyMatrixWidget.value = getAdjacencyMatrix();

// Function to get the pruned adjacency matrix of the graph
function getAdjacencyMatrix() {
  // 1. Map node IDs to a compact index [0..N-1]
  const sortedIds = nodesData.map(n=>n.id).sort((a,b)=>a-b);
  const idToIdx = {};
  sortedIds.forEach((id, i) => { idToIdx[id] = i; });

  const N = sortedIds.length;
  // 2. Build full N×N matrix of zeros
  const mat = Array.from({ length: N }, () => Array(N).fill(0));

  // 3. Fill in edges
  data.edges.forEach(({ from, to }) => {
    const i = idToIdx[from], j = idToIdx[to];
    mat[i][j] = mat[j][i] = 1;
  });

  // 4. Identify rows (and cols) that have at least one '1'
  const keepIdx = mat
    .map((row, i) => row.some(v => v !== 0) ? i : -1)
    .filter(i => i >= 0);

  // 5. Prune out zero rows/cols
  const pruned = keepIdx.map(i =>
    keepIdx.map(j => mat[i][j])
  );

  // 6. Serialize
  return pruned
    .map(row => row.join(' '))
    .join('\n');
}


// Update the adjacency matrix text when the graph changes
network.on('afterDrawing', () => {
  adjacencyMatrixWidget.value = getAdjacencyMatrix();
  adjacencyMatrixInput.value = ''; // Clear the adjacency matrix input
});

// Copy Button
const copyButton = document.createElement('button');
copyButton.textContent = 'Copy';
copyButton.addEventListener('click', () => {
  adjacencyMatrixWidget.select();
  document.execCommand('copy');
});



// Adjacency Matrix Container
const adjacencyMatrixContainer = document.createElement('div');
adjacencyMatrixContainer.className = 'adjacency-matrix-container';
adjacencyMatrixContainer.appendChild(adjacencyMatrixWidget);
adjacencyMatrixContainer.appendChild(copyButton);



// Adjacency Matrix Input
const adjacencyMatrixInput = document.createElement('textarea');
adjacencyMatrixInput.className = 'adjacency-matrix-input';
adjacencyMatrixInput.placeholder = 'Paste adjacency matrix here...';
adjacencyMatrixInput.addEventListener('blur', () => {
  const adjacencyMatrix = adjacencyMatrixInput.value.trim();
  if (adjacencyMatrix) {
    const lines = adjacencyMatrix.split('\n');
    const newNodesData = [];
    const newEdgesData = [];
    for (let i = 0; i < lines.length; i++) {
      const row = lines[i].trim().split(' ');
      for (let j = 0; j < row.length; j++) {
        const value = parseInt(row[j]);
        if (!isNaN(value) && value === 1 && i < j) {
          const from = i + 1;
          const to = j + 1;
          newEdgesData.push({ from, to });
          if (!newNodesData.some((node) => node.id === from)) {
            newNodesData.push({ id: from, label: `N ${from}` });
          }
          if (!newNodesData.some((node) => node.id === to)) {
            newNodesData.push({ id: to, label: `N ${to}` });
          }
        }
      }
    }
    nodesData = newNodesData;
    edgesData = newEdgesData;
//network.setOptions({ physics: false });
network.stopSimulation();
network.stabilize(100000);
network.startSimulation();
    //network.setOptions({ physics: { stabilization: false } });
data.nodes.clear();
data.edges.clear();
    data.nodes.add(nodesData);
    data.edges.add(edgesData);

    
//network.fit(); // Fit the network to the container
   
//network.setOptions({ physics: true });


  }
});


const adjacencyMatrixInputLabel = document.createElement('label');
adjacencyMatrixInputLabel.textContent = 'Import from text:';
adjacencyMatrixInputLabel.style.display = 'flex';
adjacencyMatrixInputLabel.style.marginBottom = '10px';

// Add things to the page
container.parentNode.appendChild(toolbox);
container.parentNode.appendChild(adjacencyMatrixContainer);
container.parentNode.appendChild(adjacencyMatrixInputLabel);
container.parentNode.appendChild(adjacencyMatrixInput);
