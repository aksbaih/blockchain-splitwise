// =============================================================================
//                                  Config
// =============================================================================

let web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

// Constant we use later
var GENESIS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// This is the ABI for your contract (get it from Remix, in the 'Compile' tab)
// ============================================================
var abi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "Balances",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "IOUs",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			},
			{
				"internalType": "uint32",
				"name": "amount",
				"type": "uint32"
			},
			{
				"internalType": "address[]",
				"name": "cycle",
				"type": "address[]"
			}
		],
		"name": "add_iou",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "debtor",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			}
		],
		"name": "lookup",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "ret",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "lookup_user_balance",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "ret",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]; // FIXME: fill this in with your contract's ABI //Be sure to only have one array, not two

// ============================================================
abiDecoder.addABI(abi);
// call abiDecoder.decodeMethod to use this - see 'getAllFunctionCalls' for more

var contractAddress = '0xC64E10B29cBCbaFD129d51A474349e4D16b67a33'; // FIXME: fill this in with your contract's address/hash
var BlockchainSplitwise = new web3.eth.Contract(abi, contractAddress);

// =============================================================================
//                            Functions To Implement
// =============================================================================

// TODO: Add any helper functions here!
var IOUs = {};

async function get_node_neighbors(node) {
    if(!(node in IOUs)) return [];
    return Object.keys(IOUs[node]);
//    var neighbors = [];
//    for(let iou of IOUs) {
//        if(iou["debtor"] === node && iou["value"] > 0) neighbors.push(iou["creditor"]);
//    }
//    return neighbors;
}

async function find_cycle_at_node(node) {
    // remove last element in the cycle because it's the same as the first
    var cycle = await doBFS(node, node, get_node_neighbors);
    if(cycle === null) return null;
    return cycle.slice(0, -1);
}

function get_iou_value(debtor, creditor) {
    console.log(debtor, creditor);
    if(!(debtor in IOUs)) return 0;
    if(!(creditor in IOUs[debtor])) return 0;
    console.log(IOUs[debtor][creditor]);
    return IOUs[debtor][creditor];
//    for(let iou of IOUs) {
//        if(iou["debtor"] === debtor && iou["creditor"] === creditor)
//            return iou["value"];
//    }
//    return 0;
}

function resolve_cycle(cycle) {
    // halt if the cycle is ill-defined
    if(cycle === null) return false;
    let cycle_length = cycle.length;
    if(cycle_length < 2) return false;
    // find minimum iou on the cycle
    var minimum_amount = Number.MAX_SAFE_INTEGER;
    for(var i = 0; i < cycle_length; i++) {
        let value = get_iou_value(cycle[i], cycle[(i+1) % cycle_length]);
        if(value < minimum_amount) minimum_amount = value;
    }
    // halt if there's no positive minimum
    console.log(minimum_amount);
    if(minimum_amount < 1) return false;
    // subtract the minimum from the cycle
    for(var i = 0; i < cycle_length; i++) {
        IOUs[cycle[i]][cycle[(i+1) % cycle_length]] -= minimum_amount;
    }
    console.log("Cycle resolved an amount of ", minimum_amount);
    return true;
}

function add_iou_local(debtor, creditor, amount) {
    if(!(debtor in IOUs)) IOUs[debtor] = {};
    if(!(creditor in IOUs[debtor])) IOUs[debtor][creditor] = 0;
    IOUs[debtor][creditor] += parseInt(amount);
}

async function reconstruct_world_state() {
    return getAllFunctionCalls(contractAddress, "add_iou").then(
        function_calls => {
            console.log("before sorting, ", function_calls);
            function_calls.sort((a, b) => (a.t < b.t) ? 1 : -1);
            console.log("after sorting, ", function_calls);
            IOUs = {};
            for(let call of function_calls) {
                // add the iou
                add_iou_local(call.from, call.args[0], call.args[1]);
                // find any emergent cycle
                let cycle = find_cycle_at_node(call.from);
                resolve_cycle(call.args[2]);
            }
            console.log("state of the world: ", IOUs);
        }
    ).catch((error) => {
        console.log("ERROR - ", error);
    });
}
// TODO: Return a list of all users (creditors or debtors) in the system
// You can return either:
//   - a list of everyone who has ever sent or received an IOU
// OR
//   - a list of everyone currently owing or being owed money
async function getUsers() {
    return getAllFunctionCalls(contractAddress, "add_iou").then(
        (function_calls) => {
            console.log(function_calls);
            var users_list = [];
            for(let call of function_calls) {
                users_list.push(call.from.toLowerCase());
                users_list.push(call.args[0].toLowerCase());
            }
            return [...new Set(users_list)];
        }
    ).catch((error) => {
        console.log("ERROR - ", error);
        return [];
    });
}

// TODO: Get the total amount owed by the user specified by 'user'
async function getTotalOwed(user) {
    return BlockchainSplitwise.methods.lookup_user_balance(user.toLowerCase()).call({from: web3.eth.defaultAccount.toLowerCase()});
}

// TODO: Get the last time this user has sent or received an IOU, in seconds since Jan. 1, 1970
// Return null if you can't find any activity for the user.
// HINT: Try looking at the way 'getAllFunctionCalls' is written. You can modify it if you'd like.
async function getLastActive(user) {
    return getAllFunctionCalls(contractAddress, "add_iou").then(
        (function_calls) => {
            console.log(function_calls);
            var last_timestamp = null;
            for(let call of function_calls) {
                if((call.from.toLowerCase() === user.toLowerCase() || call.args[0].toLowerCase() === user.toLowerCase())
                        && (last_timestamp === null || call.t > last_timestamp)) {
                    last_timestamp = call.t;
                }
            }
            return last_timestamp;
        }
    ).catch((error) => {
        console.log("ERROR - ", error);
        return null;
    });
}

// TODO: add an IOU ('I owe you') to the system
// The person you owe money is passed as 'creditor'
// The amount you owe them is passed as 'amount'
async function add_IOU(creditor, amount) {
    // reconstruct the state of the world to find an emergent cycle
    await reconstruct_world_state();
    let debtor = web3.eth.defaultAccount.toLowerCase();
    add_iou_local(debtor, creditor, amount);
    var cycle = await find_cycle_at_node(debtor);
    // discard the cycle if it doesn't resolve a change
    if(!resolve_cycle(cycle)) cycle = [];
    return BlockchainSplitwise.methods.add_iou(creditor.toLowerCase(), amount, cycle).send({from: debtor});
}

// =============================================================================
//                              Provided Functions
// =============================================================================
// Reading and understanding these should help you implement the above

// This searches the block history for all calls to 'functionName' (string) on the 'addressOfContract' (string) contract
// It returns an array of objects, one for each call, containing the sender ('from'), arguments ('args'), and the timestamp ('t')
async function getAllFunctionCalls(addressOfContract, functionName) {
	var curBlock = await web3.eth.getBlockNumber();
	var function_calls = [];

	while (curBlock !== GENESIS) {
	  var b = await web3.eth.getBlock(curBlock, true);
	  var txns = b.transactions;
	  for (var j = 0; j < txns.length; j++) {
	  	var txn = txns[j];

	  	// check that destination of txn is our contract
			if(txn.to == null){continue;}
	  	if (txn.to.toLowerCase() === addressOfContract.toLowerCase()) {
	  		var func_call = abiDecoder.decodeMethod(txn.input);

				// check that the function getting called in this txn is 'functionName'
				if (func_call && func_call.name === functionName) {
					var time = await web3.eth.getBlock(curBlock);
	  			var args = func_call.params.map(function (x) {return x.value});
	  			function_calls.push({
	  				from: txn.from.toLowerCase(),
	  				args: args,
						t: time.timestamp
	  			})
	  		}
	  	}
	  }
	  curBlock = b.parentHash;
	}
	return function_calls;
}

// We've provided a breadth-first search implementation for you, if that's useful
// It will find a path from start to end (or return null if none exists)
// You just need to pass in a function ('getNeighbors') that takes a node (string) and returns its neighbors (as an array)
async function doBFS(start, end, getNeighbors) {
	var queue = [[start]];
	while (queue.length > 0) {
		var cur = queue.shift();
		var lastNode = cur[cur.length-1]
		if (lastNode === end && cur.length > 1) {
			return cur;
		} else {
			var neighbors = await getNeighbors(lastNode);
			for (var i = 0; i < neighbors.length; i++) {
				queue.push(cur.concat([neighbors[i]]));
			}
		}
	}
	return null;
}

// =============================================================================
//                                      UI
// =============================================================================

// This sets the default account on load and displays the total owed to that
// account.
web3.eth.getAccounts().then((response)=> {
	web3.eth.defaultAccount = response[0];

	getTotalOwed(web3.eth.defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	});

	getLastActive(web3.eth.defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// This code updates the 'My Account' UI with the results of your functions
$("#myaccount").change(function() {
	web3.eth.defaultAccount = $(this).val();

	getTotalOwed(web3.eth.defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	})

	getLastActive(web3.eth.defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// Allows switching between accounts in 'My Account' and the 'fast-copy' in 'Address of person you owe
web3.eth.getAccounts().then((response)=>{
	var opts = response.map(function (a) { return '<option value="'+
			a.toLowerCase()+'">'+a.toLowerCase()+'</option>' });
	$(".account").html(opts);
	$(".wallet_addresses").html(response.map(function (a) { return '<li>'+a.toLowerCase()+'</li>' }));
});

// This code updates the 'Users' list in the UI with the results of your function
getUsers().then((response)=>{
	$("#all_users").html(response.map(function (u,i) { return "<li>"+u+"</li>" }));
});

// This runs the 'add_IOU' function when you click the button
// It passes the values from the two inputs above
$("#addiou").click(function() {
	web3.eth.defaultAccount = $("#myaccount").val(); //sets the default account
  add_IOU($("#creditor").val(), $("#amount").val()).then((response)=>{
		window.location.reload(true); // refreshes the page after add_IOU returns and the promise is unwrapped
	})
});

// This is a log function, provided if you want to display things to the page instead of the JavaScript console
// Pass in a discription of what you're printing, and then the object to print
function log(description, obj) {
	$("#log").html($("#log").html() + description + ": " + JSON.stringify(obj, null, 2) + "\n\n");
}


// =============================================================================
//                                      TESTING
// =============================================================================

// This section contains a sanity check test that you can use to ensure your code
// works. We will be testing your code this way, so make sure you at least pass
// the given test. You are encouraged to write more tests!

// Remember: the tests will assume that each of the four client functions are
// async functions and thus will return a promise. Make sure you understand what this means.

function check(name, condition) {
	if (condition) {
		console.log(name + ": SUCCESS");
		return 3;
	} else {
		console.log(name + ": FAILED");
		return 0;
	}
}

async function sanityCheck() {
	console.log ("\nTEST", "Simplest possible test: only runs one add_IOU; uses all client functions: lookup, getTotalOwed, getUsers, getLastActive");

	var score = 0;

	var accounts = await web3.eth.getAccounts();
	web3.eth.defaultAccount = accounts[0];

	var users = await getUsers();
	score += check("getUsers() initially empty", users.length === 0);

	var owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) initially empty", owed === 0);

	var lookup_0_1 = await BlockchainSplitwise.methods.lookup(accounts[0], accounts[1]).call({from:web3.eth.defaultAccount});
	score += check("lookup(0,1) initially 0", parseInt(lookup_0_1, 10) === 0);

	var response = await add_IOU(accounts[1], "10");

	users = await getUsers();
	score += check("getUsers() now length 2", users.length === 2);

	owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) now 10", owed === 10);

	lookup_0_1 = await BlockchainSplitwise.methods.lookup(accounts[0], accounts[1]).call({from:web3.eth.defaultAccount});
	score += check("lookup(0,1) now 10", parseInt(lookup_0_1, 10) === 10);

	var timeLastActive = await getLastActive(accounts[0]);
	var timeNow = Date.now()/1000;
	var difference = timeNow - timeLastActive;
	score += check("getLastActive(0) works", difference <= 60 && difference >= -3); // -3 to 60 seconds

	console.log("Final Score: " + score +"/21");
}

//sanityCheck() //Uncomment this line to run the sanity check when you first open index.html
