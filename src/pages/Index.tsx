import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Activity, TrendingUp, Layers, Zap } from "lucide-react";
import heroImage from "@/assets/hero-drilling.jpg";
import techBackground from "@/assets/tech-background.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            P-Twin
          </h1>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="hover:bg-muted"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${techBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-5xl font-bold leading-tight">
                Guide Your Drill with{" "}
                <span className="bg-gradient-to-r from-primary via-success to-primary bg-clip-text text-transparent animate-glow-pulse">
                  AI Precision
                </span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Smarter Paths at Every Meter. Analyze seismograms in real-time and optimize
                drilling trajectories with iterative AI guidance.
              </p>
              <div className="flex gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  Watch Demo
                </Button>
              </div>
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold text-success">30%</div>
                  <div className="text-sm text-muted-foreground">Error Reduction</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">Real-time</div>
                  <div className="text-sm text-muted-foreground">AI Analysis</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">95%</div>
                  <div className="text-sm text-muted-foreground">Precision</div>
                </div>
              </div>
            </div>
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <img
                  src={heroImage}
                  alt="Seismographic drilling visualization"
                  className="w-full h-auto"
                  style={{
                    boxShadow: "0 0 40px rgba(0, 255, 255, 0.3)",
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">The Virtuous Iterative Loop</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start with basic data, generate optimal paths, drill forward, refine with new images
              — continuous improvement at every meter.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Layers className="h-8 w-8" />,
                title: "Upload Seismogram",
                description: "Start with initial geological cross-section data",
                color: "primary",
              },
              {
                icon: <Activity className="h-8 w-8" />,
                title: "AI Analysis",
                description: "Detect layers, faults, and optimal drilling angles",
                color: "success",
              },
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "Generate Path",
                description: "Receive precision-optimized drilling trajectory",
                color: "primary",
              },
              {
                icon: <Zap className="h-8 w-8" />,
                title: "Advance & Recalculate",
                description: "Update path as drill progresses with new data",
                color: "success",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all group"
              >
                <CardContent className="p-6 space-y-4">
                  <div
                    className={`inline-flex p-3 rounded-lg bg-${feature.color}/10 text-${feature.color} group-hover:scale-110 transition-transform`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${techBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Transform Your Drilling Operations?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join geo-engineers worldwide using AI-powered precision guidance. Start with 5 free
            analyses.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6"
          >
            Upload Your First Seismogram
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-muted-foreground text-sm">
              © 2024 P-Twin. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                About
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Pricing
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Documentation
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
