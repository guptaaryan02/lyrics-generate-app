"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Clapperboard, PenTool, LayoutDashboard, Settings, 
  Calculator, Loader, Save, CheckCircle, Image as ImageIcon
} from "lucide-react";
import axios from "axios";

const API_BASE = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";

type ViewType = "create" | "dashboard" | "settings";

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>("create");
  
  const [apiMode, setApiMode] = useState("b2r");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [imageModel, setImageModel] = useState("gpt-image-1");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Create State
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState("1024x1024");
  const [numScenes, setNumScenes] = useState("auto");
  const [customSceneCount, setCustomSceneCount] = useState("12");
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  
  // Dashboard State
  const [apiStatus, setApiStatus] = useState("Disconnected");
  const [agentData, setAgentData] = useState<any>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadedImages = useRef(new Set<string>());

  // Initialization
  useEffect(() => {
    const savedMode = localStorage.getItem("apiMode") || "b2r";
    const savedKey = localStorage.getItem("apiKey") || "";
    const savedBaseUrl = localStorage.getItem("apiBaseUrl") || "";
    const savedModel = localStorage.getItem("imageModel") || "gpt-image-1";
    const savedNumScenes = localStorage.getItem("numScenes") || "auto";
    const savedCustomCount = localStorage.getItem("customSceneCount") || "12";
    setApiMode(savedMode);
    setApiKey(savedKey);
    setApiBaseUrl(savedBaseUrl);
    setImageModel(savedModel);
    setNumScenes(savedNumScenes);
    setCustomSceneCount(savedCustomCount);
    startPolling();
  }, []);

  const saveSettings = () => {
    localStorage.setItem("apiMode", apiMode);
    localStorage.setItem("apiKey", apiKey);
    localStorage.setItem("apiBaseUrl", apiBaseUrl);
    localStorage.setItem("imageModel", imageModel);
    localStorage.setItem("numScenes", numScenes);
    localStorage.setItem("customSceneCount", customSceneCount);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleEstimate = async () => {
    if (!lyrics.trim()) return alert("Please enter lyrics");
    setIsEstimating(true);
    try {
      const res = await axios.post(`${API_BASE}/estimate`, {
        lyrics,
        api_mode: apiMode,
        custom_api_key: apiKey,
        num_scenes: numScenes === "custom" ? customSceneCount : numScenes
      });
      setEstimate(res.data);
    } catch (err: any) {
      alert("Estimation failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsEstimating(false);
    }
  };

  const handleStart = async () => {
    setIsGenerating(true);
    try {
      await axios.post(`${API_BASE}/start`, {
        lyrics,
        style,
        api_mode: apiMode,
        custom_api_key: apiKey,
        api_base_url: apiBaseUrl,
        image_model: imageModel,
        aspect_ratio: aspectRatio,
        num_scenes: numScenes === "custom" ? customSceneCount : numScenes
      });
      setEstimate(null);
      downloadedImages.current.clear(); // Reset downloaded images tracking for new run
      setActiveView("dashboard");
    } catch (err: any) {
      alert("Failed to start: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = async () => {
    try {
      await axios.post(`${API_BASE}/cancel`);
    } catch (err) {
      console.error(err);
    }
  };

  const startPolling = () => {
    setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/status`);
        setApiStatus(`Connected (${res.data.state})`);
        setAgentData(res.data);
        
        // Check for new completed images to auto-download
        if (res.data.completed_images && Array.isArray(res.data.completed_images)) {
          res.data.completed_images.forEach((img: string) => {
            if (!downloadedImages.current.has(img)) {
              downloadedImages.current.add(img);
              // Trigger auto download
              const link = document.createElement("a");
              link.href = `${API_BASE}/download/${img}`;
              link.download = `${img}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          });
        }
      } catch (err) {
        setApiStatus("Disconnected");
      }
    }, 2000);
  };

  return (
    <div className="flex h-screen w-full font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] flex flex-col p-6">
        <div className="flex items-center gap-3 text-xl font-extrabold mb-10 text-[var(--color-primary)]">
          <Clapperboard />
          <h2>Director AI</h2>
        </div>
        
        <ul className="flex flex-col gap-2">
          <NavItem active={activeView === "create"} onClick={() => setActiveView("create")} icon={<PenTool size={18} />} label="Create" />
          <NavItem active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavItem active={activeView === "settings"} onClick={() => setActiveView("settings")} icon={<Settings size={18} />} label="Settings" />
        </ul>

        <div className="mt-auto flex items-center gap-2 text-sm text-[var(--color-text-secondary)] py-4 border-t border-[var(--color-border)]">
          <div className={`w-2 h-2 rounded-full ${apiStatus === "Disconnected" ? 'bg-[var(--color-error)]' : 'bg-[var(--color-success)]'}`} />
          <span>{apiStatus}</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        
        {/* Create View */}
        {activeView === "create" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-bold mb-2">New Project</h1>
              <p className="text-gray-400">Paste your lyrics and let the Director generate a cinematic storyboard.</p>
            </header>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-2xl backdrop-blur-md">
              <div className="flex flex-col gap-2 mb-6">
                <label className="font-semibold text-gray-400">Song Lyrics</label>
                <textarea 
                  className="input-field min-h-[250px]"
                  placeholder="Paste your lyrics here..."
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                />
              </div>

              <div className="flex gap-6 mb-6">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="font-semibold text-gray-400">Visual Style</label>
                  <select className="input-field" value={style} onChange={(e) => setStyle(e.target.value)}>
                    <option value="cinematic">Cinematic</option>
                    <option value="realistic">Ultra Realistic</option>
                    <option value="anime">Anime / Manga</option>
                    <option value="cyberpunk">Cyberpunk</option>
                    <option value="watercolor">Watercolor</option>
                    <option value="oil_painting">Oil Painting</option>
                    <option value="pixel_art">Pixel Art</option>
                    <option value="3d_render">3D Render / Pixar Style</option>
                    <option value="comic_book">Comic Book</option>
                    <option value="vintage">Vintage / Retro</option>
                    <option value="neon_fantasy">Neon Fantasy</option>
                    <option value="pencil_sketch">Pencil Sketch</option>
                    <option value="studio_photography">Studio Photography</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="font-semibold text-gray-400">Aspect Ratio</label>
                  <select className="input-field" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                    <option value="1024x1024">Square (1:1)</option>
                    <option value="1792x1024">Landscape Widescreen (16:9)</option>
                    <option value="1024x1792">Portrait Mobile (9:16)</option>
                    <option value="1536x1024">Photography Landscape (3:2)</option>
                    <option value="1024x1536">Photography Portrait (2:3)</option>
                    <option value="1365x1024">Classic Landscape (4:3)</option>
                    <option value="1024x1365">Classic Portrait (3:4)</option>
                    <option value="2400x1024">Cinematic Ultrawide (21:9)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-6 w-80">
                <label className="font-semibold text-gray-400">Number of Scenes</label>
                <div className="flex gap-2">
                  <select className="input-field flex-1" value={numScenes} onChange={(e) => setNumScenes(e.target.value)}>
                    <option value="auto">Auto (Default)</option>
                    <option value="5">5 Scenes</option>
                    <option value="10">10 Scenes</option>
                    <option value="15">15 Scenes</option>
                    <option value="20">20 Scenes</option>
                    <option value="30">30 Scenes</option>
                    <option value="custom">Custom...</option>
                  </select>
                  {numScenes === "custom" && (
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      className="input-field w-24" 
                      value={customSceneCount} 
                      onChange={(e) => setCustomSceneCount(e.target.value)} 
                    />
                  )}
                </div>
              </div>

              <div>
                <button onClick={handleEstimate} disabled={isEstimating} className="btn btn-secondary">
                  {isEstimating ? <Loader className="animate-spin" size={18} /> : <Calculator size={18} />}
                  Estimate Cost
                </button>
              </div>
            </div>

            {/* Estimator Modal */}
            {estimate && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in">
                <div className="glass p-8 rounded-2xl w-[400px] text-center">
                  <h2 className="text-2xl font-bold mb-6">Estimation Summary</h2>
                  
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-black/30 p-4 rounded-xl flex flex-col">
                      <span className="text-xs text-gray-400">Scenes</span>
                      <strong className="text-xl mt-1">{estimate.estimated_scenes}</strong>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl flex flex-col">
                      <span className="text-xs text-gray-400">Tokens</span>
                      <strong className="text-xl mt-1">{estimate.estimated_tokens}</strong>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl flex flex-col">
                      <span className="text-xs text-gray-400">Est. Cost</span>
                      <strong className="text-xl mt-1">${estimate.estimated_cost_usd.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="flex justify-between gap-4">
                    <button onClick={() => setEstimate(null)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                    <button onClick={handleStart} disabled={isGenerating} className="btn btn-primary flex-1 justify-center">
                      {isGenerating ? "Starting..." : "Start Generation"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dashboard View */}
        {activeView === "dashboard" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Active Generation</h1>
                {agentData.state !== "completed" && agentData.state !== "idle" && agentData.state !== "error" && (
                  <button onClick={handleStop} className="btn bg-[var(--color-error)] hover:bg-red-600 text-white px-4 py-2 text-sm font-semibold">
                    Stop Generation
                  </button>
                )}
              </div>
              <div className="mt-6">
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[var(--color-primary)] to-blue-400 transition-all duration-500" 
                    style={{ width: `${agentData.total_scenes ? Math.round((agentData.current_scene / agentData.total_scenes) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-400">
                  <span>{agentData.total_scenes ? Math.round((agentData.current_scene / agentData.total_scenes) * 100) : 0}%</span>
                  <span>Scene {agentData.current_scene || 0} / {agentData.total_scenes || 0}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-[2fr_1fr] gap-6">
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-2xl backdrop-blur-md">
                <h3 className="font-bold text-lg mb-4">Latest Image</h3>
                
                <div className="w-full aspect-square bg-black/30 rounded-xl flex items-center justify-center overflow-hidden">
                  {agentData.completed_images && agentData.completed_images.length > 0 ? (
                    <img 
                      src={`${API_BASE}/download/${agentData.completed_images[agentData.completed_images.length - 1]}`} 
                      className="w-full h-full object-cover animate-in fade-in zoom-in" 
                      alt="Latest Generation" 
                    />
                  ) : agentData.state === "completed" ? (
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                      <CheckCircle size={48} className="text-[var(--color-success)]" />
                      <p>Project Completed successfully!</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                      <Loader className="animate-spin" size={32} />
                      <p>Generating Scene {agentData.current_scene || 1}...</p>
                    </div>
                  )}
                </div>

                {agentData.current_scene_data && (
                  <div className="mt-4 p-4 bg-black/30 rounded-xl italic text-gray-400 text-sm">
                    "{agentData.current_scene_data.prompt}"
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-2xl backdrop-blur-md">
                  <h3 className="font-bold text-lg mb-4">Statistics</h3>
                  <div className="flex justify-between py-3 border-b border-[var(--color-border)]">
                    <span>Images Created</span>
                    <strong className="text-[var(--color-success)]">{agentData.images_created || 0}</strong>
                  </div>
                  <div className="flex justify-between py-3">
                    <span>Failed Attempts</span>
                    <strong className="text-[var(--color-error)]">{agentData.failed_count || 0}</strong>
                  </div>
                </div>

                <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-2xl backdrop-blur-md h-[300px] flex flex-col">
                  <h3 className="font-bold text-lg mb-4">Live Logs</h3>
                  <div className="flex-1 overflow-y-auto font-mono text-xs text-gray-400 flex flex-col gap-2">
                    {agentData.logs?.map((log: string, i: number) => (
                      <div key={i}>[LIVE] {log}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Storyboard Gallery */}
            {agentData.completed_images && agentData.completed_images.length > 0 && (
              <div className="mt-8 bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <ImageIcon size={20} className="text-[var(--color-primary)]" />
                  Storyboard Gallery
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {agentData.completed_images.map((img: string, i: number) => (
                    <div key={i} className="aspect-square bg-black/50 rounded-xl overflow-hidden border border-white/5 relative group cursor-pointer">
                      <img 
                        src={`${API_BASE}/download/${img}`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        alt={`Scene ${i + 1}`} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 pointer-events-none">
                        <span className="text-sm font-bold drop-shadow-md">Scene {i + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings View */}
        {activeView === "settings" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-gray-400">Configure your API preferences and application behavior.</p>
            </header>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-2xl backdrop-blur-md max-w-xl">
              <div className="flex flex-col gap-2 mb-6">
                <label className="font-semibold text-gray-400">API Provider Mode</label>
                <select className="input-field" value={apiMode} onChange={(e) => setApiMode(e.target.value)}>
                  <option value="b2r">Use B2R API (Default)</option>
                  <option value="custom">Use Custom OpenAI API Key</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 mb-6 mt-6 pt-6 border-t border-[var(--color-border)]">
                <label className="font-semibold text-gray-400">Image Generation Engine</label>
                <select className="input-field" value={imageModel} onChange={(e) => setImageModel(e.target.value)}>
                  <option value="gpt-image-2">gpt-image-2</option>
                  <option value="gpt-image-2-2026-04-21">gpt-image-2-2026-04-21</option>
                  <option value="gpt-image-1">gpt-image-1</option>
                  <option value="gpt-image-1.5">gpt-image-1.5</option>
                  <option value="gpt-image-1-mini">gpt-image-1-mini</option>
                  <option value="chatgpt-image-latest">chatgpt-image-latest</option>
                  <option value="dall-e-3">dall-e-3 (OpenAI)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Select the AI engine for image generation. Defaults to gpt-image-1.</p>
              </div>

              {apiMode === "custom" && (
                <div className="flex flex-col gap-6 mb-6 animate-in fade-in">
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-400">Custom Provider API Key</label>
                    <input 
                      type="password"
                      className="input-field"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Stored locally in your browser.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-400">Custom Base URL (Optional)</label>
                    <input 
                      type="text"
                      className="input-field"
                      placeholder="https://api.openai.com/v1"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave blank to use default OpenAI endpoint.</p>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <button onClick={saveSettings} className="btn btn-primary">
                  {settingsSaved ? <><CheckCircle size={18}/> Saved!</> : <><Save size={18}/> Save Settings</>}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Helper Component for Sidebar Items
function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <li 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
        active ? 'bg-blue-500/10 text-[var(--color-primary)] font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </li>
  );
}
