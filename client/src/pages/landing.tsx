import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Zap, 
  Headphones, 
  Target, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2,
  Mic,
  Brain,
  Clock,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: <Headphones className="h-6 w-6" />,
    title: "Passive Learning",
    description: "Learn from your real conversations. Just wear your Omi necklace and speak naturally.",
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "AI-Powered Analysis",
    description: "Gemini AI analyzes your speech patterns and identifies areas for improvement.",
  },
  {
    icon: <Target className="h-6 w-6" />,
    title: "Daily Challenges",
    description: "Get personalized challenges based on your actual mistakes. No generic exercises.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Spaced Repetition",
    description: "SM-2 algorithm ensures you review at optimal intervals for long-term retention.",
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Track Progress",
    description: "Watch your CEFR level improve as you master grammar and vocabulary.",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Gamified Experience",
    description: "Earn XP, maintain streaks, and unlock achievements to stay motivated.",
  },
];

const steps = [
  {
    number: "01",
    title: "Wear Your Omi",
    description: "Put on your Omi necklace and go about your day. Have conversations naturally.",
  },
  {
    number: "02",
    title: "AI Analyzes Your Speech",
    description: "Our AI identifies grammar mistakes, vocabulary gaps, and pronunciation patterns.",
  },
  {
    number: "03",
    title: "Practice & Improve",
    description: "Complete daily challenges tailored to your actual speech patterns and level up!",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl">LinguaFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Login</Link>
            </Button>
            <Button asChild data-testid="button-get-started">
              <Link href="/dashboard">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  <Mic className="h-4 w-4" />
                  Powered by Omi AI Necklace
                </motion.div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground leading-tight">
                  Learn languages{" "}
                  <span className="text-primary">naturally</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg">
                  Turn everyday conversations into personalized language lessons. 
                  Your Omi necklace records, our AI teaches.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg px-8" asChild>
                  <Link href="/dashboard">
                    Start Learning Free
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Works with any Omi device</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-teal-600/20 rounded-3xl blur-3xl" />
              <Card className="relative bg-card/80 backdrop-blur border-2">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Today's Challenge</p>
                        <p className="text-sm text-muted-foreground">Grammar correction</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10">
                        <p className="text-sm text-muted-foreground mb-1">You said:</p>
                        <p className="font-medium">"I go to school yesterday"</p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                        <p className="text-sm text-muted-foreground mb-1">Better:</p>
                        <p className="font-medium">"I went to school yesterday"</p>
                      </div>
                    </div>

                    <Button className="w-full">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Got it!
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold font-display text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to transform your daily conversations into language mastery
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="relative h-full">
                  <CardContent className="p-8">
                    <span className="text-6xl font-bold font-display text-primary/20">
                      {step.number}
                    </span>
                    <h3 className="text-xl font-bold font-display text-foreground mt-4 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold font-display text-foreground mb-4">
              Features that accelerate learning
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining wearable AI with proven learning science
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-bold font-display text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-br from-primary to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-4xl md:text-5xl font-bold font-display">
              Ready to learn naturally?
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Join thousands of learners who are mastering new languages through their everyday conversations.
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8"
              asChild
            >
              <Link href="/dashboard">
                Get Started Free
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <footer className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold">LinguaFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built with Omi AI Necklace and Gemini
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
