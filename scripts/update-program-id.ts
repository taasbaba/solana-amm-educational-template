import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

interface UpdateTarget {
  filePath: string;
  description: string;
  searchPattern: RegExp;
  replaceTemplate: string;
}

const UPDATE_TARGETS: UpdateTarget[] = [
  // 1. Anchor.toml - localnet
  {
    filePath: "./Anchor.toml",
    description: "Anchor.toml localnet program ID",
    searchPattern: /(\[programs\.localnet\]\s*solana_amm_educational_template\s*=\s*")([^"]+)(")/g,
    replaceTemplate: "$1{NEW_PROGRAM_ID}$3"
  },
  
  // 2. Anchor.toml - devnet
  {
    filePath: "./Anchor.toml", 
    description: "Anchor.toml devnet program ID",
    searchPattern: /(\[programs\.devnet\]\s*solana_amm_educational_template\s*=\s*")([^"]+)(")/g,
    replaceTemplate: "$1{NEW_PROGRAM_ID}$3"
  },
  
  // 3. lib.rs - declare_id
  {
    filePath: "./programs/solana-amm-educational-template/src/lib.rs",
    description: "lib.rs declare_id macro",
    searchPattern: /(declare_id!\s*\(\s*")([^"]+)("\s*\)\s*;)/g,
    replaceTemplate: "$1{NEW_PROGRAM_ID}$3"
  },
  
  // 4. setup-devnet-pool.ts - IDL address
  {
    filePath: "./scripts/setup-devnet-pool.ts",
    description: "setup-devnet-pool.ts IDL address",
    searchPattern: /("address":\s*")([^"]+)(",)/g,
    replaceTemplate: "$1{NEW_PROGRAM_ID}$3"
  },
  
  // 5. setup-devnet-pool.ts - programId constant
  {
    filePath: "./scripts/setup-devnet-pool.ts",
    description: "setup-devnet-pool.ts programId constant",
    searchPattern: /(const\s+programId\s*=\s*new\s+PublicKey\s*\(\s*")([^"]+)("\s*\)\s*;)/g,
    replaceTemplate: "$1{NEW_PROGRAM_ID}$3"
  }
];

interface UpdateResult {
  success: boolean;
  filePath: string;
  description: string;
  oldProgramId?: string;
  newProgramId?: string;
  error?: string;
  changes: number;
}

async function updateProgramId() {
  try {
    console.log("PROGRAM ID UPDATER");
    console.log("==================");
    console.log("Generating new program ID and updating all references...\n");

    // 1. Generate new program ID keypair
    const newKeypair = Keypair.generate();
    const newProgramId = newKeypair.publicKey.toString();
    const secretKeyArray = Array.from(newKeypair.secretKey);

    console.log("NEW PROGRAM ID GENERATED:");
    console.log("========================");
    console.log(`Public Key: ${newProgramId}`);

    // 2. Update keys/program-id.json
    const programIdPath = "./keys/program-id.json";
    const keysDir = "./keys";
    
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }
    
    fs.writeFileSync(programIdPath, JSON.stringify(secretKeyArray, null, 2));
    
    // Generate base64 from the JSON file (like base64 -i keys/program-id.json | tr -d '\n')
    const jsonContent = fs.readFileSync(programIdPath, 'utf8');
    const base64SecretKey = Buffer.from(jsonContent).toString('base64');
    
    console.log(`Base64 Secret: ${base64SecretKey}\n`);

    console.log("UPDATED KEYPAIR FILE:");
    console.log("====================");
    console.log(`${programIdPath} - New keypair saved\n`);

    // 3. Read old program ID from first file (for reference)
    let oldProgramId = "UNKNOWN";
    const firstTarget = UPDATE_TARGETS[0];
    if (fs.existsSync(firstTarget.filePath)) {
      const content = fs.readFileSync(firstTarget.filePath, "utf8");
      const match = content.match(firstTarget.searchPattern);
      if (match && match[0]) {
        const extractMatch = match[0].match(/"([^"]+)"/);
        if (extractMatch) {
          oldProgramId = extractMatch[1];
        }
      }
    }

    console.log("PROGRAM ID CHANGE:");
    console.log("==================");
    console.log(`Old Program ID: ${oldProgramId}`);
    console.log(`New Program ID: ${newProgramId}\n`);

    // 4. Update all target files
    console.log("UPDATING FILES:");
    console.log("===============");
    
    const updateResults: UpdateResult[] = [];
    
    for (const target of UPDATE_TARGETS) {
      const result: UpdateResult = {
        success: false,
        filePath: target.filePath,
        description: target.description,
        changes: 0
      };

      try {
        if (!fs.existsSync(target.filePath)) {
          result.error = "File not found";
          console.log(`SKIP: ${target.filePath} - File not found`);
          updateResults.push(result);
          continue;
        }

        let content = fs.readFileSync(target.filePath, "utf8");
        const originalContent = content;
        
        // Replace with new program ID
        const replaceString = target.replaceTemplate.replace("{NEW_PROGRAM_ID}", newProgramId);
        content = content.replace(target.searchPattern, replaceString);
        
        // Count changes
        const originalMatches = originalContent.match(target.searchPattern);
        const newMatches = content.match(target.searchPattern);
        result.changes = originalMatches ? originalMatches.length : 0;
        
        if (content !== originalContent) {
          fs.writeFileSync(target.filePath, content);
          result.success = true;
          result.oldProgramId = oldProgramId;
          result.newProgramId = newProgramId;
          console.log(`SUCCESS: ${target.description} - ${result.changes} replacements`);
        } else {
          result.error = "No matches found";
          console.log(`SKIP: ${target.description} - No matches found`);
        }

      } catch (error) {
        result.error = error instanceof Error ? error.message : "Unknown error";
        console.log(`ERROR: ${target.description} - ${result.error}`);
      }
      
      updateResults.push(result);
    }

    // 5. Update target/deploy/ if it exists (optional)
    const targetDeployPath = "./target/deploy/solana_amm_educational_template-keypair.json";
    if (fs.existsSync("./target/deploy")) {
      fs.writeFileSync(targetDeployPath, JSON.stringify(secretKeyArray, null, 2));
      console.log(`UPDATED: ${targetDeployPath}\n`);
    }

    // 6. Generate summary
    console.log("UPDATE SUMMARY:");
    console.log("===============");
    const successCount = updateResults.filter(r => r.success).length;
    const totalCount = updateResults.length;
    console.log(`Successfully updated: ${successCount}/${totalCount} files`);
    
    if (successCount > 0) {
      console.log("\nSuccessful updates:");
      updateResults.filter(r => r.success).forEach(r => {
        console.log(`  ✓ ${r.description} (${r.changes} changes)`);
      });
    }
    
    const failedResults = updateResults.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log("\nFailed/Skipped updates:");
      failedResults.forEach(r => {
        console.log(`  ✗ ${r.description} - ${r.error}`);
      });
    }

    // 7. Next steps
    console.log("\nNEXT STEPS:");
    console.log("===========");
    console.log("1. Review the changes in your files");
    console.log("2. Run: anchor build");
    console.log("3. Run: anchor deploy --provider.cluster devnet");
    console.log("4. Update your frontend/scripts with the new program ID");
    
    console.log("\nGITHUB ACTION INFO:");
    console.log("===================");
    console.log("If using GitHub Actions, update this secret:");
    console.log(`PROGRAM_ID_BASE64: ${base64SecretKey}`);

    console.log("\nBACKUP REMINDER:");
    console.log("================");
    console.log("If you need to revert, the old program ID was:");
    console.log(oldProgramId);

    // 8. Save update log
    const logData = {
      timestamp: new Date().toISOString(),
      oldProgramId: oldProgramId,
      newProgramId: newProgramId,
      base64SecretKey: base64SecretKey,
      updateResults: updateResults,
      successCount: successCount,
      totalCount: totalCount
    };

    const generateDir = "./generate";
    if (!fs.existsSync(generateDir)) {
      fs.mkdirSync(generateDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(generateDir, "program_id_update_log.json"),
      JSON.stringify(logData, null, 2)
    );

    console.log("\nUPDATE LOG SAVED:");
    console.log("=================");
    console.log("generate/program_id_update_log.json");

    console.log("\nPROGRAM ID UPDATE COMPLETE!");

  } catch (error) {
    console.error("Program ID update failed:");
    console.error(error);
    process.exit(1);
  }
}

// Export for use in other scripts
export interface ProgramIdUpdateOptions {
  targetProgramId?: string; // Use specific program ID instead of generating new one
  skipConfirmation?: boolean;
  backupFiles?: boolean;
}

export async function updateProgramIdWithOptions(options: ProgramIdUpdateOptions = {}) {
  // This function can be extended for programmatic use
  return updateProgramId();
}

// Run if called directly
if (require.main === module) {
  updateProgramId();
}