"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { contractAddress, CONTRACT_ABI, SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_HEX } from "@/contractABI";

type WalletWindow = Window & {
  ethereum?: any;
};

interface EscrowItem {
  id: number;
  client: string;
  freelancer: string;
  amount: string;
  isCompleted: boolean;
  isDisputed: boolean;
}

export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [freelancer, setFreelancer] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.05");
  const [manageId, setManageId] = useState<string>("1");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [escrowList, setEscrowList] = useState<EscrowItem[]>([]);

  // Switch network to Sepolia
  const switchToSepolia = async () => {
    const ethereum = (window as WalletWindow).ethereum;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      setChainId(SEPOLIA_CHAIN_ID);
      setIsError(false);
      setStatusMsg("Switched to Sepolia network successfully.");
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia Test Network",
                rpcUrls: ["https://rpc.sepolia.org"],
                nativeCurrency: {
                  name: "Sepolia ETH",
                  symbol: "SEP",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          setChainId(SEPOLIA_CHAIN_ID);
        } catch (addError) {
          console.error("Failed to add Sepolia network:", addError);
        }
      } else {
        console.error("Failed to switch to Sepolia network:", switchError);
      }
    }
  };

  // Fetch All Escrows from Smart Contract
  const fetchEscrows = useCallback(async (providerParam?: ethers.BrowserProvider) => {
    try {
      const ethereum = (window as WalletWindow).ethereum;
      if (!ethereum) return;

      if (!ethers.isAddress(contractAddress)) {
        setIsError(true);
        setStatusMsg("Invalid contract address configured.");
        return;
      }

      const activeProvider = providerParam || new ethers.BrowserProvider(ethereum);
      const network = await activeProvider.getNetwork();
      const currentChain = Number(network.chainId);
      setChainId(currentChain);

      const code = await activeProvider.getCode(contractAddress);
      if (code === "0x") {
        if (currentChain !== SEPOLIA_CHAIN_ID) {
          setIsError(true);
          setStatusMsg(
            `Contract is deployed on Sepolia (Chain 11155111). Your wallet is on chain ${currentChain}. Please switch to Sepolia.`
          );
        } else {
          setIsError(true);
          setStatusMsg("Contract not found on Sepolia network. Please check contract address.");
        }
        return;
      }

      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, activeProvider);

      const totalCount = await contract.escrowCount();
      const count = Number(totalCount);
      const fetchedEscrows: EscrowItem[] = [];

      for (let i = 1; i <= count; i++) {
        const item = await contract.escrows(i);
        fetchedEscrows.push({
          id: i,
          client: item.client,
          freelancer: item.freelancer,
          amount: ethers.formatEther(item.amount),
          isCompleted: item.isCompleted,
          isDisputed: item.isDisputed,
        });
      }

      setEscrowList(fetchedEscrows.reverse()); // Show newest first
    } catch (err: any) {
      console.error("Error fetching escrows:", err);
      setIsError(true);
      setStatusMsg(err?.reason || err?.message || "Failed to fetch escrows");
    }
  }, []);

  // Wallet Connection
  const connectWallet = async () => {
    const ethereum = (window as WalletWindow).ethereum;
    if (typeof window !== "undefined" && ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const userAccount = accounts[0];
        setAccount(userAccount);

        const network = await provider.getNetwork();
        const currentChain = Number(network.chainId);
        setChainId(currentChain);

        if (currentChain !== SEPOLIA_CHAIN_ID) {
          await switchToSepolia();
        }

        const userBalance = await provider.getBalance(userAccount);
        setBalance(ethers.formatEther(userBalance));

        fetchEscrows(provider);
      } catch (err: any) {
        setIsError(true);
        setStatusMsg(err?.message || "Wallet connection failed!");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  useEffect(() => {
    const ethereum = (window as WalletWindow).ethereum;
    if (ethereum?.on) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const provider = new ethers.BrowserProvider(ethereum);
          const userBalance = await provider.getBalance(accounts[0]);
          setBalance(ethers.formatEther(userBalance));
          fetchEscrows(provider);
        } else {
          setAccount("");
          setBalance("");
          setEscrowList([]);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
        ethereum.removeListener?.("chainChanged", handleChainChanged);
      };
    }
  }, [fetchEscrows]);

  useEffect(() => {
    if (account) {
      fetchEscrows();
    }
  }, [account, fetchEscrows]);

  // Create Escrow
  const handleCreateEscrow = async () => {
    if (!account) return alert("Please connect wallet first!");
    if (!freelancer || !amount) return alert("Please fill all fields!");

    try {
      setIsLoading(true);
      setStatusMsg("Initiating transaction in MetaMask...");
      setIsError(false);

      const provider = new ethers.BrowserProvider((window as WalletWindow).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      const tx = await contract.createEscrow(freelancer, {
        value: ethers.parseEther(amount),
      });

      setStatusMsg("Waiting for block confirmation...");
      await tx.wait();

      setStatusMsg(`Escrow #${escrowList.length + 1} created successfully!`);
      setIsLoading(false);
      setFreelancer("");
      fetchEscrows(provider);
    } catch (err: any) {
      setIsLoading(false);
      setIsError(true);
      setStatusMsg(err.reason || err.message || "Transaction failed");
    }
  };

  // Manage Escrow Actions (Release / Submit / Dispute)
  const handleManageAction = async (actionType: "submit" | "release" | "dispute") => {
    if (!account) return alert("Please connect wallet first!");
    if (!manageId) return alert("Enter Escrow ID!");

    try {
      setIsLoading(true);
      setIsError(false);
      const provider = new ethers.BrowserProvider((window as WalletWindow).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      let tx;
      if (actionType === "submit") {
        setStatusMsg(`Submitting work for Escrow #${manageId}...`);
        tx = await contract.submitWork(manageId);
      } else if (actionType === "release") {
        setStatusMsg(`Releasing funds for Escrow #${manageId}...`);
        tx = await contract.releaseFunds(manageId);
      } else {
        setStatusMsg(`Raising dispute for Escrow #${manageId}...`);
        tx = await contract.raiseDispute(manageId);
      }

      await tx.wait();
      setStatusMsg(`Action '${actionType}' completed successfully!`);
      setIsLoading(false);
      fetchEscrows(provider);
    } catch (err: any) {
      setIsLoading(false);
      setIsError(true);
      setStatusMsg(err.reason || err.message || "Action failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            TrustLedge 🛡️
          </h1>
          <p className="text-xs text-slate-400">Decentralized Web3 Escrow & Dispute Resolution</p>
        </div>

        {account ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
            {chainId === SEPOLIA_CHAIN_ID ? (
              <span className="text-xs text-emerald-400 font-mono block">● Sepolia (Chain 11155111)</span>
            ) : (
              <button
                onClick={switchToSepolia}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-mono block"
                title="Click to switch to Sepolia testnet"
              >
                ⚠️ Wrong Network (Click to switch to Sepolia)
              </button>
            )}
            <span className="text-sm font-mono text-slate-200">
              {account.substring(0, 6)}...{account.substring(account.length - 4)} |{" "}
              <span className="text-blue-400">{balance ? parseFloat(balance).toFixed(4) : "0.0000"} ETH</span>
            </span>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg transition"
          >
            Connect Wallet
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        {/* Status Alert Banner */}
        {statusMsg && (
          <div
            className={`p-4 rounded-xl text-sm font-mono border ${
              isError
                ? "bg-red-950/50 border-red-800 text-red-300"
                : "bg-emerald-950/50 border-emerald-800 text-emerald-300"
            }`}
          >
            {statusMsg}
          </div>
        )}

        {/* Action Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Escrow Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">Create New Escrow</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Freelancer Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={freelancer}
                  onChange={(e) => setFreelancer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Deposit Amount (ETH)</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleCreateEscrow}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Fund & Create Escrow"}
              </button>
            </div>
          </div>

          {/* Manage Escrow Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">Manage Escrow</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Escrow ID</label>
                <input
                  type="text"
                  value={manageId}
                  onChange={(e) => setManageId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleManageAction("submit")}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg font-medium text-sm transition"
                >
                  Submit Work
                </button>

                <button
                  onClick={() => handleManageAction("release")}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-500 py-2.5 rounded-lg font-medium text-sm transition"
                >
                  Release Funds
                </button>
              </div>

              <button
                onClick={() => handleManageAction("dispute")}
                disabled={isLoading}
                className="w-full border border-red-800 bg-red-950/30 hover:bg-red-900/50 text-red-300 py-2.5 rounded-lg font-medium text-sm transition"
              >
                Raise Dispute
              </button>
            </div>
          </div>
        </div>

        {/* Active Escrows / History Table Section */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-200">Escrow Contracts List</h2>
            <button
              onClick={() => fetchEscrows()}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Refresh List
            </button>
          </div>

          {escrowList.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No escrows found on contract yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Freelancer</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {escrowList.map((escrow) => (
                    <tr key={escrow.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-blue-400">#{escrow.id}</td>
                      <td className="p-3 text-slate-300">
                        {escrow.client.substring(0, 6)}...{escrow.client.substring(38)}
                      </td>
                      <td className="p-3 text-slate-300">
                        {escrow.freelancer.substring(0, 6)}...{escrow.freelancer.substring(38)}
                      </td>
                      <td className="p-3 text-emerald-400">{escrow.amount} ETH</td>
                      <td className="p-3">
                        {escrow.isDisputed ? (
                          <span className="px-2 py-1 bg-red-950 border border-red-800 text-red-400 rounded">
                            Disputed
                          </span>
                        ) : escrow.isCompleted ? (
                          <span className="px-2 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-950 border border-blue-800 text-blue-400 rounded">
                            Active / Funded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
