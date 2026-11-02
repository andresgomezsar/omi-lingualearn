import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Headphones, Search, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { LearningItem } from "@shared/schema";

export default function LearningItems() {
  const { data: items, isLoading } = useQuery<LearningItem[]>({
    queryKey: ["/api/learning-items"],
  });

  const [search, setSearch] = useState("");
  const displayItems = (items || []).filter(item => `${item.originalText} ${item.correctedText} ${item.explanation}`.toLowerCase().includes(search.toLowerCase()));

  const isDue = (item: LearningItem) => {
    if (!item.dueDate) return true;
    return new Date(item.dueDate) <= new Date();
  };

  const dueItems = displayItems.filter(isDue);
  const upcomingItems = displayItems.filter(i => !isDue(i));

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">
              Learning Items
            </h1>
            <p className="text-muted-foreground">
              {displayItems.length} items in your learning queue
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-items"
          />
        </div>
      </motion.div>

      {dueItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold font-display text-foreground">
              Due for Review ({dueItems.length})
            </h2>
          </div>

          <div className="grid gap-3">
            {isLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)
            ) : (
              dueItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LearningItemCard item={item} due />
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold font-display text-foreground">
            Upcoming ({upcomingItems.length})
          </h2>
        </div>

        <div className="grid gap-3">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)
          ) : upcomingItems.length > 0 ? (
            upcomingItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <LearningItemCard item={item} />
              </motion.div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No upcoming reviews
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LearningItemCard({ item, due = false }: { item: LearningItem; due?: boolean }) {
  const categoryColors: Record<string, string> = {
    grammar: "bg-primary/10 text-primary",
    vocabulary: "bg-accent/10 text-accent-foreground",
    pronunciation: "bg-secondary/10 text-secondary-foreground",
  };

  return (
    <Card
      className={`transition-all duration-200 ${due ? "border-orange-500/30" : ""}`}
      data-testid={`card-learning-item-${item.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className={categoryColors[item.category || "grammar"]}
              >
                {item.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {item.repetitions || 0} reviews
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground line-through">{item.originalText}</span>
              </p>
              <p className="text-sm font-medium text-foreground">
                {item.correctedText}
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-muted-foreground">
            {due ? (
              <span className="text-orange-500 font-medium">Due now</span>
            ) : item.dueDate ? (
              <span>Due {formatDistanceToNow(new Date(item.dueDate), { addSuffix: true })}</span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
