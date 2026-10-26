export const CONTRACT_ADDRESS = "0x20d8b839A1e882eebB6e0451C1AD7E739B738295";
export const contractAddress = CONTRACT_ADDRESS; // backward compatibility

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export const CONTRACT_ABI = [
  "function createEscrow(address _freelancer) external payable",
  "function submitWork(uint256 _escrowId) external",
  "function releaseFunds(uint256 _escrowId) external",
  "function raiseDispute(uint256 _escrowId) external",
  "function escrowCount() view returns (uint256)",
  "function escrows(uint256) view returns (address client, address freelancer, uint256 amount, bool isCompleted, bool isDisputed)"
];