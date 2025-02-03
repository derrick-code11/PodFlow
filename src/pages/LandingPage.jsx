import {
  Mic,
  Clock,
  Users,
  Link as LinkIcon,
  FileText,
  ArrowRight,
  Upload,
  Wand2,
  FileEdit,
  Download,
  Star,
  Plus,
  Minus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import Navbar from "../components/ui/Navbar";

const features = [
  {
    icon: <Mic className="w-6 h-6" />,
    title: "Automated Summaries",
    description: "Convert audio into concise, structured show notes using AI",
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: "Smart Timestamps",
    description: "Extract key moments and time markers automatically",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Guest Information",
    description: "Identify guest names, bios, and references mentioned",
  },
  {
    icon: <LinkIcon className="w-6 h-6" />,
    title: "Resource Links",
    description: "Pull out important links and references from conversations",
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: "Export Options",
    description: "Download in Markdown, Text, or HTML formats",
  },
];

const processSteps = [
  {
    icon: <Upload className="w-8 h-8" />,
    title: "Upload Your Episode",
    description: "Simply drag & drop your podcast audio file or paste a link",
  },
  {
    icon: <Wand2 className="w-8 h-8" />,
    title: "AI Processing",
    description: "Our AI analyzes and extracts key information automatically",
  },
  {
    icon: <FileEdit className="w-8 h-8" />,
    title: "Review & Edit",
    description: "Fine-tune the generated notes to match your style",
  },
  {
    icon: <Download className="w-8 h-8" />,
    title: "Export",
    description: "Download your polished show notes in your preferred format",
  },
];

const testimonial = {
  content:
    "PodFlow has completely transformed how I create show notes. What used to take hours now takes minutes, and the quality is consistently excellent.",
  author: "Sarah Chen",
  role: "Tech Podcast Host",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces",
};

const faqs = [
  {
    question: "How does PodFlow generate show notes?",
    answer:
      "PodFlow uses advanced AI technology (OpenAI's Whisper for transcription and GPT for summarization) to analyze your podcast audio and automatically generate structured show notes, including summaries, timestamps, and guest information.",
  },
  {
    question: "What audio formats are supported?",
    answer:
      "We support most common audio formats including MP3, WAV, M4A, and OGG. You can either upload files directly or paste a link to your episode.",
  },
  {
    question: "How accurate are the generated show notes?",
    answer:
      "Our AI provides highly accurate results, but we always recommend a quick review and edit before publishing. The editor interface makes it easy to refine the content to match your style perfectly.",
  },
  {
    question: "Can I customize the format of my show notes?",
    answer:
      "Yes! You can edit any part of the generated notes and export them in various formats including Markdown, Text, or HTML. The notes are fully customizable to match your preferred structure and style.",
  },
];

export default function LandingPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <div className="relative w-full h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src="https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&q=80"
            alt="Studio microphone background"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0" />
        </div>

        {/* Hero Content */}
        <div className="relative container mx-auto px-4 text-center">
          <div className="max-w-[520px] mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-primary">
              PodFlow
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-muted-foreground text-white">
              Transform your podcast episodes into structured show notes with
              AI-powered automation
            </p>
            <div className="mt-10 space-y-4">
              <Link
                to="/login"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:text-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <div className="flex items-center justify-center gap-4 text-muted-foreground">
                <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
                <span className="text-white">Trusted by podcasters worldwide</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Process Steps Section */}
      <div id="how-it-works" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Your Journey Made Simple
            </h2>
            <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
              Generate professional show notes in just a few steps
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {processSteps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      {step.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                  {index < processSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/4 right-0 w-full h-0.5 bg-primary/20 -z-10 transform translate-x-1/2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Podcast Production Made Effortless
            </h2>
            <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
              Everything you need for professional podcast show notes
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow border border-border text-center"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-[1200px] mx-auto">
            <div className="max-w-3xl mx-auto text-center">
              <div className="mb-8">
                <div className="flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-6 h-6 text-yellow-400"
                      fill="currentColor"
                    />
                  ))}
                </div>
              </div>
              <div className="relative inline-block">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.author}
                  className="w-20 h-20 rounded-full mb-6 object-cover border-4 border-background"
                />
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 to-primary/40 blur-lg -z-10" />
              </div>
              <blockquote className="text-xl md:text-2xl font-medium mb-8">
                "{testimonial.content}"
              </blockquote>
              <div className="text-muted-foreground">
                <cite className="font-semibold not-italic">
                  {testimonial.author}
                </cite>
                <span className="mx-2">•</span>
                <span>{testimonial.role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div id="faq" className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <div className="max-w-3xl mx-auto mt-8">
              {faqs.map((faq, index) => (
                <div key={index} className="mb-4">
                  <button
                    className="flex justify-between items-center w-full px-4 py-3 text-left bg-card hover:bg-muted/50 rounded-lg focus:outline-none"
                    onClick={() =>
                      setOpenFaqIndex(openFaqIndex === index ? null : index)
                    }
                  >
                    <span className="font-medium">{faq.question}</span>
                    {openFaqIndex === index ? (
                      <Minus className="w-5 h-5 text-primary" />
                    ) : (
                      <Plus className="w-5 h-5 text-primary" />
                    )}
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-4 py-3 text-muted-foreground text-left">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative w-full py-16">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80"
            alt="Podcast setup"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background" />
        </div>
        <div className="relative container mx-auto px-4">
          <div className="max-w-[1200px] text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center leading-tight">
                Ready to streamline your podcast workflow?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 mx-auto max-w-[30ch] leading-relaxed">
                Join now and start generating professional show notes in minutes
              </p>
              <Link
                to="/login"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Get Started Now <ArrowRight className="ml-2 w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
