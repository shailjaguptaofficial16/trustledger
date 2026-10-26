const hre = require("hardhat");

async function main() {
  console.log("Deploying TrustLedge Escrow contract...");

  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();

  await escrow.waitForDeployment();

  console.log(`Escrow contract successfully deployed to: ${await escrow.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});