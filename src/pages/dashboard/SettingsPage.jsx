import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Loader2,
  Save,
  Key,
  Clock,
  FileText,
  Link2,
  MessageSquare,
  Database,
  Settings2,
} from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { auth } from "../../lib/firebase";
import {
  getUserSettings,
  updateUserSettings,
} from "../../lib/firebase/settings";

export default function SettingsPage() {
  const [user] = useAuthState(auth);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Settings state
  const [settings, setSettings] = useState({
    // API Settings
    openaiApiKey: "",

    // Content Generation Settings
    defaultLanguage: "en",
    autoGenerateShowNotes: true,
    includeTimestamps: true,
    includeGuestInfo: true,
    includeResourceLinks: true,
    includeCallsToAction: true,
    defaultCallToAction: "Don't forget to like, subscribe, and leave a review!",

    // Export Settings
    defaultExportFormat: "markdown",
    includeHeaderSection: true,
    includeFooterSection: true,
    customHeaderText: "",
    customFooterText: "",

    // Storage Settings
    retainOriginalAudio: false,
    retainTranscripts: true,
    autoDeleteAfterDays: 30,
  });

  // Load user settings
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;

      try {
        setIsLoading(true);
        const userSettings = await getUserSettings(user.uid);
        if (userSettings) {
          setSettings(userSettings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        setError("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateUserSettings(user.uid, settings);
      setSuccess("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      setError("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Settings</h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-4 rounded-md">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* API Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              <h2 className="text-lg font-semibold">API Settings</h2>
            </div>
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <label htmlFor="openaiApiKey" className="text-sm font-medium">
                  OpenAI API Key
                </label>
                <input
                  id="openaiApiKey"
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, openaiApiKey: e.target.value })
                  }
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-background"
                />
                <p className="text-sm text-muted-foreground">
                  Required for AI-powered show notes generation
                </p>
              </div>
            </div>
          </div>

          {/* Content Generation Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Content Generation</h2>
            </div>
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <label
                  htmlFor="defaultLanguage"
                  className="text-sm font-medium"
                >
                  Default Language
                </label>
                <select
                  id="defaultLanguage"
                  value={settings.defaultLanguage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultLanguage: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoGenerateShowNotes"
                    checked={settings.autoGenerateShowNotes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        autoGenerateShowNotes: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="autoGenerateShowNotes"
                    className="text-sm font-medium"
                  >
                    Automatically generate show notes after upload
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeTimestamps"
                    checked={settings.includeTimestamps}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeTimestamps: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="includeTimestamps"
                    className="text-sm font-medium"
                  >
                    Include timestamps in show notes
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeGuestInfo"
                    checked={settings.includeGuestInfo}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeGuestInfo: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="includeGuestInfo"
                    className="text-sm font-medium"
                  >
                    Extract guest information
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeResourceLinks"
                    checked={settings.includeResourceLinks}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeResourceLinks: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="includeResourceLinks"
                    className="text-sm font-medium"
                  >
                    Extract resource links
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeCallsToAction"
                    checked={settings.includeCallsToAction}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeCallsToAction: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="includeCallsToAction"
                    className="text-sm font-medium"
                  >
                    Include call to action
                  </label>
                </div>

                {settings.includeCallsToAction && (
                  <div className="space-y-2 pl-6">
                    <label
                      htmlFor="defaultCallToAction"
                      className="text-sm font-medium"
                    >
                      Default Call to Action
                    </label>
                    <textarea
                      id="defaultCallToAction"
                      value={settings.defaultCallToAction}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultCallToAction: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Export Settings</h2>
            </div>
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <label
                  htmlFor="defaultExportFormat"
                  className="text-sm font-medium"
                >
                  Default Export Format
                </label>
                <select
                  id="defaultExportFormat"
                  value={settings.defaultExportFormat}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultExportFormat: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background"
                >
                  <option value="markdown">Markdown</option>
                  <option value="text">Plain Text</option>
                  <option value="html">HTML</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeHeaderSection"
                    checked={settings.includeHeaderSection}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeHeaderSection: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="includeHeaderSection"
                    className="text-sm font-medium"
                  >
                    Include header section
                  </label>
                </div>

                {settings.includeHeaderSection && (
                  <div className="space-y-2 pl-6">
                    <label
                      htmlFor="customHeaderText"
                      className="text-sm font-medium"
                    >
                      Custom Header Text
                    </label>
                    <textarea
                      id="customHeaderText"
                      value={settings.customHeaderText}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customHeaderText: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background resize-none"
                      placeholder="Enter custom header text..."
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeFooterSection"
                    checked={settings.includeFooterSection}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeFooterSection: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="includeFooterSection"
                    className="text-sm font-medium"
                  >
                    Include footer section
                  </label>
                </div>

                {settings.includeFooterSection && (
                  <div className="space-y-2 pl-6">
                    <label
                      htmlFor="customFooterText"
                      className="text-sm font-medium"
                    >
                      Custom Footer Text
                    </label>
                    <textarea
                      id="customFooterText"
                      value={settings.customFooterText}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customFooterText: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background resize-none"
                      placeholder="Enter custom footer text..."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Storage Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Storage Settings</h2>
            </div>
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="retainOriginalAudio"
                    checked={settings.retainOriginalAudio}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        retainOriginalAudio: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="retainOriginalAudio"
                    className="text-sm font-medium"
                  >
                    Keep original audio files
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="retainTranscripts"
                    checked={settings.retainTranscripts}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        retainTranscripts: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="retainTranscripts"
                    className="text-sm font-medium"
                  >
                    Keep transcripts
                  </label>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="autoDeleteAfterDays"
                    className="text-sm font-medium"
                  >
                    Auto-delete after (days)
                  </label>
                  <input
                    type="number"
                    id="autoDeleteAfterDays"
                    value={settings.autoDeleteAfterDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        autoDeleteAfterDays: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background"
                  />
                  <p className="text-sm text-muted-foreground">
                    Set to 0 to keep forever
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
