import type { ArticleAction, Category, ChatMessage, Story } from "../types/news";

export const categories: Category[] = [
  {
    id: "top-stories",
    label: "Top Stories",
    iconPath: "M12 3l7 4v6c0 4-3 7-7 9-4-2-7-5-7-9V7l7-4z",
  },
  {
    id: "world",
    label: "World",
    iconPath: "M12 2a10 10 0 100 20 10 10 0 000-20z",
  },
  {
    id: "politics",
    label: "Politics",
    iconPath: "M4 6h16v4H4V6zm0 6h10v4H4v-4z",
  },
  {
    id: "technology",
    label: "Technology",
    iconPath: "M7 4h10v6H7V4zm-2 9h14v7H5v-7z",
  },
  {
    id: "business",
    label: "Business",
    iconPath: "M4 7h16v12H4V7zm3-3h10v3H7V4z",
  },
  {
    id: "health",
    label: "Health",
    iconPath: "M11 4h2v4h4v2h-4v4h-2v-4H7V8h4V4z",
  },
  {
    id: "science",
    label: "Science",
    iconPath: "M9 3h6v2H9V3zm-2 4h10l-1 8H8L7 7z",
  },
  {
    id: "sports",
    label: "Sports",
    iconPath: "M6 5h12v12H6V5zm2 2v8h8V7H8z",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    iconPath: "M4 6h16v12H4V6zm3 2v8l8-4-8-4z",
  },
];

export const topStories: Story[] = [
  {
    id: "markets",
    title: "Global Markets Surge as Recovery Gains Momentum",
    summary: "Analysts see renewed confidence across tech and energy sectors.",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 2 hours ago",
    detailSummary:
      "Global equities rallied on renewed investor confidence as supply chains stabilized and earnings surprises emerged across key sectors. Analysts say the rally is broad-based, with tech and energy leading gains while central banks signal patience on rate adjustments.",
    highlights: [
      "Energy and semiconductor indexes posted the strongest weekly gains since early summer.",
      "Strategists expect volatility to remain elevated amid upcoming inflation data.",
    ],
  },
  {
    id: "innovation",
    title: "Tech Giants Unveil New Innovations at Annual Conference",
    summary: "AI-first devices and edge compute models take center stage.",
    image:
      "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 3 hours ago",
    detailSummary:
      "Major hardware and cloud providers showcased new AI-first devices, including on-device copilots and accelerated edge compute stacks. The conference emphasized privacy-preserving models and a shift toward developer-focused toolchains.",
    highlights: [
      "New product lines prioritize local inference and lower power consumption.",
      "Open-source partnerships expand access to model optimization tooling.",
    ],
  },
  {
    id: "earthquake",
    title: "Major Earthquake Strikes City, Rescue Efforts Underway",
    summary: "Emergency responders continue search and recovery operations.",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 4 hours ago",
    detailSummary:
      "A powerful 7.8 magnitude earthquake struck the city early this morning, causing widespread destruction. Rescue teams are working tirelessly to search for survivors trapped under the rubble. Emergency services are on the scene and aftershocks continue to shake the area.",
    highlights: [
      "Authorities urge residents to stay away from damaged buildings as rescue efforts continue.",
      "Temporary shelters and medical triage centers have been activated across the region.",
    ],
  },
  {
    id: "health-study",
    title: "New Health Study Reveals Benefits of Mediterranean Diet",
    summary: "Researchers cite improved heart health and longevity markers.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 4 hours ago",
    detailSummary:
      "A multi-year study suggests that a Mediterranean-style diet correlates with improved cardiovascular outcomes and better long-term health indicators. Researchers emphasize whole grains, olive oil, and plant-forward meals as key contributors.",
    highlights: [
      "Participants saw lower inflammatory markers and improved metabolic profiles.",
      "Dietary adherence was linked to higher energy levels and sleep quality.",
    ],
  },
  {
    id: "climate-grid",
    title: "Climate Tech Fuels Smarter Power Grids",
    summary: "Utilities adopt AI forecasting to stabilize renewable output.",
    image:
      "https://images.unsplash.com/photo-1509395176047-4a66953fd231?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 5 hours ago",
    detailSummary:
      "Grid operators are integrating AI forecasting models to balance renewable energy variability. The shift improves storage utilization and reduces peak demand stress across regional networks.",
    highlights: [
      "Battery deployments increased as utilities prepare for summer demand spikes.",
      "New demand-response pilots target industrial and residential customers.",
    ],
  },
  {
    id: "space-launch",
    title: "Private Space Firms Accelerate Launch Cadence",
    summary: "Lower costs open new commercial imaging missions.",
    image:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 6 hours ago",
    detailSummary:
      "Launch providers are booking record numbers of payloads as costs decline and satellite constellations scale. Analysts expect increased competition for ground-station bandwidth.",
    highlights: [
      "Earth-observation startups expand analytics coverage for agriculture.",
      "Regulators weigh new orbital debris mitigation requirements.",
    ],
  },
  {
    id: "fintech-lending",
    title: "Fintech Lending Rebounds as Defaults Ease",
    summary: "Risk models improve as consumer demand stabilizes.",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 7 hours ago",
    detailSummary:
      "Digital lenders are reporting healthier repayment trends after tightening underwriting models. The rebound is driven by mid-market borrowers and small business demand.",
    highlights: [
      "Delinquency rates drop across short-term credit products.",
      "Investors return to asset-backed securities tied to loan pools.",
    ],
  },
  {
    id: "medical-ai",
    title: "Hospitals Pilot AI Triage for Emergency Rooms",
    summary: "Early trials show faster intake and safer prioritization.",
    image:
      "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 8 hours ago",
    detailSummary:
      "Healthcare systems are testing AI-supported triage to reduce wait times and improve patient routing. Clinicians emphasize that the systems remain advisory and audited.",
    highlights: [
      "Pilot programs cut average intake time by 18%.",
      "New governance policies require bias and safety reviews.",
    ],
  },
  {
    id: "supply-chains",
    title: "Supply Chains Reroute as Ports Hit Capacity",
    summary: "Shippers diversify routes to reduce bottlenecks.",
    image:
      "https://images.unsplash.com/photo-1494412685616-a5d310fbb07d?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 9 hours ago",
    detailSummary:
      "Freight operators are shifting volumes to secondary ports and rail corridors to avoid delays. The strategy comes as demand spikes for consumer goods ahead of holidays.",
    highlights: [
      "Rail and inland depots report higher throughput.",
      "Retailers extend inventory lead times to maintain stock.",
    ],
  },
  {
    id: "cyber-security",
    title: "Cybersecurity Firms Roll Out Zero-Trust Suites",
    summary: "Enterprise buyers consolidate security tooling.",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 10 hours ago",
    detailSummary:
      "Vendors are packaging zero-trust features into unified platforms, aiming to reduce tool sprawl. CIOs cite better visibility and simplified compliance reporting.",
    highlights: [
      "Spending shifts from point solutions to bundled platforms.",
      "New audits prioritize identity and endpoint telemetry.",
    ],
  },
  {
    id: "sports-economy",
    title: "Sports Economy Grows with New Media Deals",
    summary: "Streaming partnerships boost league revenues.",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 11 hours ago",
    detailSummary:
      "Leagues are securing multi-year streaming agreements that expand global audiences. Analysts say regional partnerships will drive premium advertising inventory.",
    highlights: [
      "Smaller leagues gain exposure through bundled packages.",
      "Teams invest in immersive broadcast experiences.",
    ],
  },
  {
    id: "creative-economy",
    title: "Creative Economy Gains from Short-Form Video",
    summary: "Brands shift budgets toward creator partnerships.",
    image:
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80",
    updatedAt: "Updated 12 hours ago",
    detailSummary:
      "Short-form platforms are attracting a higher share of marketing spend. Agencies emphasize performance-based contracts and branded series to retain attention.",
    highlights: [
      "Creator tools add advanced analytics for audience retention.",
      "Brand safety standards tighten after recent policy changes.",
    ],
  },
];

export const articleActions: ArticleAction[] = [
  {
    id: "share",
    label: "Share",
    iconPath: "M6 12l6-6 6 6-2 2-4-4-4 4-2-2z",
  },
  {
    id: "tweet",
    label: "Tweet",
    iconPath: "M19 7.5c-.6.3-1.2.4-1.9.5.7-.4 1.1-1 1.3-1.8-.6.4-1.3.6-2 .8a3.3 3.3 0 00-5.6 3c-2.7-.1-5-1.4-6.6-3.4-.9 1.7-.4 3.8 1.1 4.9-.5 0-1-.1-1.5-.4 0 1.8 1.3 3.4 3 3.7-.5.2-1 .2-1.5.1.4 1.5 1.8 2.5 3.4 2.5A6.7 6.7 0 014 18.5a9.4 9.4 0 005.1 1.5c6.1 0 9.5-5.1 9.5-9.5v-.4c.7-.5 1.3-1.1 1.8-1.7z",
  },
  {
    id: "copy",
    label: "Copy Link",
    iconPath: "M8 7h9a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2zm0-4h9v2H8V3z",
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "What is the latest update on the earthquake?",
    time: "10:21",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content:
      "The latest update is that over 50 people have been rescued so far, but many are still missing. Rescue operations are ongoing, and authorities are urging for more resources and volunteers to assist on-site.",
    time: "10:22",
  },
  {
    id: "assistant-2",
    role: "assistant",
    content:
      "I'm tracking verified updates and official statements to keep the incident timeline clean and searchable.",
    time: "10:23",
  },
];
