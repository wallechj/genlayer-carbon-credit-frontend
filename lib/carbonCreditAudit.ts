import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { studionet } from "genlayer-js/chains";

export interface Project {
  id: number | string;
  owner: string;
  project_name: string;
  registry_url: string;
  monitoring_report_url: string;
  claimed_credits: number | string;
  verified_credits: number | string;
  vintage_year: number | string;
  methodology: string;
  status: string;
  created_at: number | string;
}

export interface Challenge {
  id: number | string;
  project_id: number | string;
  challenger: string;
  title: string;
  statement: string;
  credits_affected: number | string;
  evidence_url: string;
  claimed_severity: string;
  status: string;
  ruled_severity: string;
  triage_summary: string;
  evidence: string;
  submitted_at: number | string;
}

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xa726dD7561504C142355434601333c49D8643e8F") as `0x${string}`;
const STUDIO_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";

/** Bridge between the Next.js frontend and the CarbonCreditAudit intelligent contract. */
export class CarbonCreditAudit {
  private client: ReturnType<typeof createClient>;

  constructor(address?: string | null) {
    const config: Record<string, unknown> = {
      chain: studionet,
      endpoint: STUDIO_URL,
    };
    if (address) config.account = address as `0x${string}`;
    this.client = createClient(config as never);
  }

  // ---- reads (free, no signature) ----

  async getProjectCount(): Promise<number> {
    const n: unknown = await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_project_count",
      args: [],
    });
    return Number(n);
  }

  async getChallengeCount(): Promise<number> {
    const n: unknown = await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_challenge_count",
      args: [],
    });
    return Number(n);
  }

  async getProject(projectId: number): Promise<Project> {
    return (await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_project",
      args: [projectId],
    })) as unknown as Project;
  }

  async getChallenge(challengeId: number): Promise<Challenge> {
    return (await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_challenge",
      args: [challengeId],
    })) as unknown as Challenge;
  }

  async getVerifiedCredits(projectId: number): Promise<number> {
    const n: unknown = await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_verified_credits",
      args: [projectId],
    });
    return Number(n);
  }

  async getChallengeStatus(challengeId: number): Promise<string> {
    return (await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_challenge_status",
      args: [challengeId],
    })) as unknown as string;
  }

  async getChallengeSeverity(challengeId: number): Promise<string> {
    return (await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_challenge_severity",
      args: [challengeId],
    })) as unknown as string;
  }

  async getChallengeEvidence(challengeId: number): Promise<string> {
    return (await this.client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_challenge_evidence",
      args: [challengeId],
    })) as unknown as string;
  }

  async getProjects(): Promise<Project[]> {
    const count = await this.getProjectCount();
    const projects: Project[] = [];
    for (let i = 0; i < count; i++) projects.push(await this.getProject(i));
    return projects;
  }

  async getChallenges(): Promise<Challenge[]> {
    const count = await this.getChallengeCount();
    const challenges: Challenge[] = [];
    for (let i = 0; i < count; i++) challenges.push(await this.getChallenge(i));
    return challenges;
  }

  // ---- writes (MetaMask signature, consensus takes minutes) ----
  // Each write returns the transaction hash. The caller waits for FINALIZED
  // with waitFinalized() and then re-reads state. ACCEPTED is never treated
  // as final: on GenLayer, a transaction can be accepted by consensus and
  // still carry an execution error, so only FINALIZED counts.

  async waitFinalized(hash: `0x${string}`) {
    return this.client.waitForTransactionReceipt({
      hash: hash as never,
      status: TransactionStatus.FINALIZED,
      retries: 120,
      interval: 10000,
    });
  }

  async createProject(input: {
    projectName: string;
    registryUrl: string;
    monitoringReportUrl: string;
    claimedCredits: number;
    vintageYear: number;
    methodology: string;
  }): Promise<`0x${string}`> {
    const hash = await this.client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "create_project",
      value: 0n,
      args: [
        input.projectName,
        input.registryUrl,
        input.monitoringReportUrl,
        input.claimedCredits,
        input.vintageYear,
        input.methodology,
      ],
    });
    return hash as unknown as `0x${string}`;
  }

  async submitChallenge(input: {
    projectId: number;
    title: string;
    statement: string;
    creditsAffected: number;
    evidenceUrl: string;
    claimedSeverity: string;
  }): Promise<`0x${string}`> {
    const hash = await this.client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "submit_challenge",
      value: 0n,
      args: [
        input.projectId,
        input.title,
        input.statement,
        input.creditsAffected,
        input.evidenceUrl,
        input.claimedSeverity,
      ],
    });
    return hash as unknown as `0x${string}`;
  }

  async assessChallenge(challengeId: number): Promise<`0x${string}`> {
    const hash = await this.client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "assess_challenge",
      value: 0n,
      args: [challengeId],
    });
    return hash as unknown as `0x${string}`;
  }

  async closeProject(projectId: number): Promise<`0x${string}`> {
    const hash = await this.client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "close_project",
      value: 0n,
      args: [projectId],
    });
    return hash as unknown as `0x${string}`;
  }

  async reopenProject(projectId: number): Promise<`0x${string}`> {
    const hash = await this.client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "reopen_project",
      value: 0n,
      args: [projectId],
    });
    return hash as unknown as `0x${string}`;
  }
}
