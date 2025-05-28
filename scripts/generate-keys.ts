import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

interface KeypairConfig {
  filename: string;
  description: string;
  category: string;
  skipGeneration?: boolean;
}

const KEYPAIRS_TO_GENERATE: KeypairConfig[] = [
  // 1. Deployer Wallet (skip generation, but show info)
  {
    filename: "devnet-deployer.json",
    description: "Deployer wallet for devnet operations",
    category: "Deployer",
    skipGeneration: true
  },

  // 2. Currency Token Mints
  {
    filename: "ntd-mint.json",
    description: "New Taiwan Dollar (NTD) token mint",
    category: "Currency Mints"
  },
  {
    filename: "usd-mint.json", 
    description: "US Dollar (USD) token mint",
    category: "Currency Mints"
  },
  {
    filename: "yen-mint.json",
    description: "Japanese Yen (YEN) token mint", 
    category: "Currency Mints"
  },

  // 3. Pool Vaults - NTD/USD Stable Pool
  {
    filename: "ntd-usd-vault-a.json",
    description: "NTD vault for NTD/USD stable pool",
    category: "NTD/USD Pool Vaults"
  },
  {
    filename: "ntd-usd-vault-b.json",
    description: "USD vault for NTD/USD stable pool",
    category: "NTD/USD Pool Vaults"
  },

  // 4. Pool Vaults - USD/YEN Standard Pool
  {
    filename: "usd-yen-vault-a.json",
    description: "USD vault for USD/YEN standard pool",
    category: "USD/YEN Pool Vaults"
  },
  {
    filename: "usd-yen-vault-b.json",
    description: "YEN vault for USD/YEN standard pool", 
    category: "USD/YEN Pool Vaults"
  },

  // 5. Pool Vaults - NTD/YEN Concentrated Pool
  {
    filename: "ntd-yen-vault-a.json",
    description: "NTD vault for NTD/YEN concentrated pool",
    category: "NTD/YEN Pool Vaults"
  },
  {
    filename: "ntd-yen-vault-b.json",
    description: "YEN vault for NTD/YEN concentrated pool",
    category: "NTD/YEN Pool Vaults"
  }
];

interface GeneratedKeypairInfo {
  filename: string;
  description: string;
  publicKey: string;
  base64SecretKey: string;
  category: string;
}

interface KeysOutput {
  generatedAt: string;
  totalKeypairs: number;
  keypairs: GeneratedKeypairInfo[];
  githubActionSecrets: { [key: string]: string };
  deploymentCommands: string[];
}

async function generateAllKeypairs() {
  try {
    console.log("SOLANA AMM KEYPAIR GENERATOR");
    console.log("===============================");
    console.log("Generating keypairs for 3-pool currency exchange AMM (FORCE MODE)...\n");

    // Create directories
    const keysDir = "./keys";
    const generateDir = "./generate";
    
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
      console.log("Created keys/ directory\n");
    }
    
    if (!fs.existsSync(generateDir)) {
      fs.mkdirSync(generateDir, { recursive: true });
      console.log("Created generate/ directory\n");
    }

    const generatedKeypairs: GeneratedKeypairInfo[] = [];
    const githubActionSecrets: { [key: string]: string } = {};
    const deploymentCommands: string[] = [];

    // Process each keypair
    for (const config of KEYPAIRS_TO_GENERATE) {
      const filepath = path.join(keysDir, config.filename);
      let keypair: Keypair;
      let publicKey: string;
      let secretKeyArray: number[];
      let base64SecretKey: string;

      if (config.skipGeneration) {
        // Handle deployer wallet - read existing or show placeholder
        if (fs.existsSync(filepath)) {
          const existingSecretKey = JSON.parse(fs.readFileSync(filepath, "utf8"));
          keypair = Keypair.fromSecretKey(new Uint8Array(existingSecretKey));
          publicKey = keypair.publicKey.toString();
          secretKeyArray = existingSecretKey;
          base64SecretKey = Buffer.from(new Uint8Array(existingSecretKey)).toString('base64');
          
          console.log(`INFO: Using existing ${config.filename}`);
          console.log(`   Public Key: ${publicKey}`);
          console.log(`   Description: ${config.description}\n`);
        } else {
          console.log(`WARNING: ${config.filename} not found - you need to provide this manually`);
          console.log(`   Description: ${config.description}`);
          console.log(`   This should be your main deployer wallet\n`);
          continue;
        }
      } else {
        // Generate new keypair (force overwrite) for all other files
        keypair = Keypair.generate();
        publicKey = keypair.publicKey.toString();
        secretKeyArray = Array.from(keypair.secretKey);
        base64SecretKey = Buffer.from(keypair.secretKey).toString('base64');
        
        // Force write to file
        fs.writeFileSync(filepath, JSON.stringify(secretKeyArray, null, 2));
        
        console.log(`GENERATED: ${config.filename}`);
        console.log(`   Public Key: ${publicKey}`);
        console.log(`   Description: ${config.description}\n`);
      }

      // Store keypair info
      const keypairInfo: GeneratedKeypairInfo = {
        filename: config.filename,
        description: config.description,
        publicKey: publicKey,
        base64SecretKey: base64SecretKey,
        category: config.category
      };

      generatedKeypairs.push(keypairInfo);

      // Generate GitHub Action secret format (skip for deployer)
      if (!config.skipGeneration) {
        const secretName = config.filename.replace('.json', '').replace('-', '_').toUpperCase() + '_BASE64';
        githubActionSecrets[secretName] = base64SecretKey;
        
        // Generate deployment command
        const deployCommand = `echo "${secretName}" | base64 -d > keys/${config.filename}`;
        deploymentCommands.push(deployCommand);
      }
    }

    // Check program-id.json consistency
    console.log("PROGRAM ID CONSISTENCY CHECK:");
    console.log("=============================");
    
    const programIdPath = "./keys/program-id.json";
    const targetDeployPath = "./target/deploy/solana_amm_educational_template-keypair.json";
    
    let programIdConsistent = true;
    let keysProgramId = "NOT_FOUND";
    let targetProgramId = "NOT_FOUND";
    
    if (fs.existsSync(programIdPath)) {
      try {
        const keysSecretKey = JSON.parse(fs.readFileSync(programIdPath, "utf8"));
        const keysKeypair = Keypair.fromSecretKey(new Uint8Array(keysSecretKey));
        keysProgramId = keysKeypair.publicKey.toString();
      } catch (error) {
        keysProgramId = "INVALID_FORMAT";
      }
    }
    
    if (fs.existsSync(targetDeployPath)) {
      try {
        const targetSecretKey = JSON.parse(fs.readFileSync(targetDeployPath, "utf8"));
        const targetKeypair = Keypair.fromSecretKey(new Uint8Array(targetSecretKey));
        targetProgramId = targetKeypair.publicKey.toString();
      } catch (error) {
        targetProgramId = "INVALID_FORMAT";
      }
    }
    
    programIdConsistent = keysProgramId === targetProgramId && keysProgramId !== "NOT_FOUND";
    
    console.log(`keys/program-id.json: ${keysProgramId}`);
    console.log(`target/deploy/keypair: ${targetProgramId}`);
    
    if (programIdConsistent) {
      console.log("STATUS: Program IDs are consistent!");
    } else if (keysProgramId === "NOT_FOUND" && targetProgramId === "NOT_FOUND") {
      console.log("STATUS: No program ID files found - run update_program_id.ts first");
    } else if (keysProgramId === "NOT_FOUND") {
      console.log("STATUS: keys/program-id.json missing - run update_program_id.ts");
    } else if (targetProgramId === "NOT_FOUND") {
      console.log("STATUS: target/deploy/ keypair missing - run update_program_id.ts");
    } else {
      console.log("STATUS: Program IDs are INCONSISTENT - run update_program_id.ts");
    }
    console.log();

    // Create output data structure
    const keysOutput: KeysOutput = {
      generatedAt: new Date().toISOString(),
      totalKeypairs: generatedKeypairs.length,
      keypairs: generatedKeypairs,
      githubActionSecrets: githubActionSecrets,
      deploymentCommands: deploymentCommands
    };

    // Write to generate/keys.json
    const outputPath = path.join(generateDir, "keys.json");
    fs.writeFileSync(outputPath, JSON.stringify(keysOutput, null, 2));

    // Print Summary
    console.log("KEYPAIR GENERATION COMPLETE!");
    console.log("================================");
    console.log(`Total Keypairs: ${generatedKeypairs.length}`);
    console.log(`Output File: ${outputPath}\n`);
    
    console.log("KEYPAIRS BY CATEGORY:");
    console.log("-----------------------------------");
    
    const categorized = generatedKeypairs.reduce((acc, kp) => {
      if (!acc[kp.category]) acc[kp.category] = [];
      acc[kp.category].push(kp);
      return acc;
    }, {} as { [key: string]: GeneratedKeypairInfo[] });
    
    Object.entries(categorized).forEach(([category, keypairs]) => {
      console.log(`\n${category}:`);
      keypairs.forEach(kp => {
        console.log(`  • ${kp.filename}`);
        console.log(`    ${kp.description}`);
        console.log(`    Public Key: ${kp.publicKey}`);
      });
    });

    console.log("\nGITHUB ACTION SECRETS:");
    console.log("======================");
    console.log("Add these as repository secrets:\n");
    
    Object.entries(githubActionSecrets).forEach(([secretName, base64Value]) => {
      console.log(`${secretName}:`);
      console.log(`${base64Value}\n`);
    });

    console.log("GITHUB ACTION DEPLOYMENT COMMANDS:");
    console.log("==================================");
    console.log("Use these in your workflow:\n");
    
    deploymentCommands.forEach(command => {
      console.log(command);
    });

    console.log("\nFILES CREATED:");
    console.log("==============");
    console.log(`• ${outputPath} (all keypair data)`);
    generatedKeypairs.forEach(kp => {
      if (!KEYPAIRS_TO_GENERATE.find(k => k.filename === kp.filename)?.skipGeneration) {
        console.log(`• keys/${kp.filename}`);
      }
    });
    
    if (generatedKeypairs.find(kp => kp.filename === "program-id.json")) {
      console.log(`• target/deploy/solana_amm_educational_template-keypair.json`);
    }

    console.log("\nNEXT STEPS:");
    console.log("===========");
    console.log("1. If program IDs are inconsistent, run: npx ts-node update_program_id.ts");
    console.log("2. Add the GitHub Action secrets to your repository");
    console.log("3. Fund your deployer wallet (if needed):");
    
    const deployerKeypair = generatedKeypairs.find(kp => kp.filename === "devnet-deployer.json");
    if (deployerKeypair) {
      console.log(`   solana airdrop 1 ${deployerKeypair.publicKey} --url devnet`);
    }
    
    console.log("3. Run the pool setup script");
    console.log("4. Your program ID is now locked to prevent changes");

    console.log("\nSECURITY REMINDER:");
    console.log("==================");
    console.log("• These are devnet keys - DO NOT use on mainnet");
    console.log("• The generate/keys.json contains sensitive data");
    console.log("• Keep GitHub Action secrets secure");

  } catch (error) {
    console.error("Keypair generation failed:");
    console.error(error);
    process.exit(1);
  }
}

// Additional utility function to verify all required keys exist
export function verifyAllKeysExist(): boolean {
  console.log("Verifying all required keypairs exist...");
  
  let allExist = true;
  const missing: string[] = [];
  
  for (const config of KEYPAIRS_TO_GENERATE) {
    const filepath = path.join("./keys", config.filename);
    if (!fs.existsSync(filepath)) {
      missing.push(config.filename);
      allExist = false;
    }
  }
  
  if (allExist) {
    console.log("All required keypairs exist!");
  } else {
    console.log("Missing keypairs:");
    missing.forEach(filename => console.log(`  • ${filename}`));
    console.log("\nRun: npx ts-node generate_keys.ts");
  }
  
  return allExist;
}

// Export keypair configs for use in other scripts
export { KEYPAIRS_TO_GENERATE };

// Run if called directly
if (require.main === module) {
  generateAllKeypairs();
}