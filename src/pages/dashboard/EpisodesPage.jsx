import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../../lib/firebase";
import {
  fetchUserEpisodes,
  deleteEpisode,
  exportEpisode,
} from "../../lib/firebase/episodes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  MoreHorizontal,
  FileEdit,
  Trash2,
  Download,
  Loader2,
  Youtube,
  Video,
  Search,
  Plus,
  FileAudio,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

// Test data
const testEpisodes = [
  {
    id: "1",
    title: "Getting Started with React",
    sourceType: "youtube",
    status: "ready",
    createdAt: "2024-01-15T10:00:00Z",
    duration: "45:20",
  },
  {
    id: "2",
    title: "Advanced TypeScript Patterns",
    sourceType: "vimeo",
    status: "processing",
    createdAt: "2024-01-14T15:30:00Z",
    duration: "32:15",
  },
  {
    id: "3",
    title: "Building Scalable Applications",
    sourceType: "youtube",
    status: "archived",
    createdAt: "2024-01-13T09:15:00Z",
    duration: "58:40",
  },
];

const buttonStyle = "bg-blue-500 hover:bg-blue-600 text-white font-medium";

// Status options for consistency
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

// Source options for consistency
const SOURCE_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "upload", label: "Upload" },
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
];

export default function EpisodesPage() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [episodeToDelete, setEpisodeToDelete] = useState(null);
  const [error, setError] = useState(null);

  // Fetch episodes on component mount
  useEffect(() => {
    async function loadEpisodes() {
      if (!user) return;

      try {
        setIsLoading(true);
        const fetchedEpisodes = await fetchUserEpisodes(user.uid);
        setEpisodes(fetchedEpisodes);
        setError(null);
      } catch (err) {
        setError("Failed to load episodes");
        console.error("Error loading episodes:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadEpisodes();
  }, [user]);

  // Handle episode deletion
  const handleDeleteClick = (episode) => {
    setEpisodeToDelete(episode);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!episodeToDelete) return;

    try {
      await deleteEpisode(episodeToDelete.id);
      setEpisodes(episodes.filter((ep) => ep.id !== episodeToDelete.id));
      setError(null);
    } catch (err) {
      setError("Failed to delete episode");
      console.error("Error deleting episode:", err);
    } finally {
      setDeleteDialogOpen(false);
      setEpisodeToDelete(null);
    }
  };

  // Handle episode export
  const handleExport = async (episode, format) => {
    try {
      await exportEpisode(episode, format);
      setError(null);
    } catch (err) {
      setError("Failed to export episode");
      console.error("Error exporting episode:", err);
    }
  };

  const handleEditClick = (episodeId) => {
    navigate(`/dashboard/episodes/${episodeId}`);
  };

  // Filter and sort episodes
  const filteredAndSortedEpisodes = episodes
    .filter((episode) => {
      // Search filter
      const matchesSearch = episode.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || episode.status === statusFilter;

      // Source filter
      const matchesSource =
        sourceFilter === "all" || episode.sourceType === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    })
    .sort((a, b) => {
      // Sort logic
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "a-z":
          return a.title.localeCompare(b.title);
        case "z-a":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Episodes</h1>
          </div>
          <Button
            onClick={() => navigate("/dashboard/episodes/new")}
            className={buttonStyle}
          >
            Create New Episode
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search episodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="Newest First" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="a-z">Title A-Z</SelectItem>
              <SelectItem value="z-a">Title Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {/* Episodes Table */}
        <div className="rounded-md border">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredAndSortedEpisodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">
                  {episodes.length === 0
                    ? "No episodes yet"
                    : "No episodes match your filters"}
                </h3>
                <p className="text-muted-foreground">
                  {episodes.length === 0
                    ? "Create your first episode to get started"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
              {episodes.length === 0 && (
                <Button
                  onClick={() => navigate("/dashboard/episodes/new")}
                  className={buttonStyle}
                >
                  <Plus className="mr-2 h-4 w-4" /> Create New Episode
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedEpisodes.map((episode) => (
                  <TableRow key={episode.id}>
                    <TableCell className="font-medium">
                      {episode.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn("h-2.5 w-2.5 rounded-full", {
                            "bg-yellow-500": episode.status === "processing",
                            "bg-green-500": episode.status === "ready",
                            "bg-blue-500": episode.status === "published",
                            "bg-gray-500": episode.status === "archived",
                          })}
                        />
                        <span className="capitalize">{episode.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {episode.sourceType === "youtube" ? (
                          <Youtube className="h-4 w-4 text-red-500" />
                        ) : episode.sourceType === "vimeo" ? (
                          <Video className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileAudio className="h-4 w-4 text-purple-500" />
                        )}
                        <span className="capitalize">{episode.sourceType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(
                        episode.createdAt?.seconds * 1000
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditClick(episode.id)}
                          >
                            <FileEdit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Download className="mr-2 h-4 w-4" />
                              Export
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleExport(episode, "markdown")
                                }
                              >
                                Markdown
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExport(episode, "pdf")}
                              >
                                PDF
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClick(episode)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                episode "{episodeToDelete?.title}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
