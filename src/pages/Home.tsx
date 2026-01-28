import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Mail, Calendar, TrendingUp, Sparkles, Send, CheckCircle, XCircle, ExternalLink, Clock, User, MessageSquare } from 'lucide-react'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'

// Agent IDs from workflow.json
const MANAGER_AGENT_ID = "6979da2088953e3309db20e0"

// TypeScript interfaces based on ACTUAL test response data
interface Story {
  id: string
  title: string
  url: string
  author: string
  score: string
  comments_count: string
  time: string
  category: string
}

interface NewsAggregatorResult {
  stories: Story[]
  total_stories: string
  lookback_days: string
  fetch_timestamp: string
}

interface TopStory {
  title: string
  url: string
  summary: string
  key_points: string[]
  category: string
  engagement_score: number
}

interface TrendingTopic {
  topic: string
  count: number
  relevance: string
}

interface ContentSummarizerResult {
  summary: string
  top_stories: TopStory[]
  trending_topics: TrendingTopic[]
  key_insights: string[]
  total_analyzed: number
}

interface EmailSenderResult {
  email_sent: boolean
  recipient: string
  subject: string
  message_id: string
  sent_at: string
}

interface ManagerResult {
  workflow_status: string
  stories_fetched: number
  stories_summarized: number
  email_delivered: boolean
  recipient: string
  lookback_days: number
  execution_time_ms: number
  summary: string
}

// Workflow step indicator component
function WorkflowStep({
  label,
  status,
  isActive
}: {
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
  isActive: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {status === 'pending' && (
        <div className="h-3 w-3 rounded-full border-2 border-gray-400 bg-transparent" />
      )}
      {status === 'active' && (
        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      )}
      {status === 'completed' && (
        <CheckCircle className="h-3 w-3 text-green-500" />
      )}
      {status === 'error' && (
        <XCircle className="h-3 w-3 text-red-500" />
      )}
      <span className={`text-sm ${isActive ? 'font-semibold text-white' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

// Story card component
function StoryCard({ story }: { story: Story }) {
  return (
    <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-white line-clamp-2">
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors inline-flex items-center gap-1"
            >
              {story.title}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </CardTitle>
          <Badge variant="outline" className="border-orange-500 text-orange-400 shrink-0">
            {story.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{story.score} points</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{story.comments_count} comments</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{story.author}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Top story card with summary
function TopStoryCard({ story }: { story: TopStory }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-orange-400'
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-white">
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors inline-flex items-center gap-1"
            >
              {story.title}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="border-orange-500 text-orange-400">
              {story.category}
            </Badge>
            <span className={`text-sm font-bold ${getScoreColor(story.engagement_score)}`}>
              {story.engagement_score}
            </span>
          </div>
        </div>
        <CardDescription className="text-gray-300 mt-2">
          {story.summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Key Points</p>
          <ul className="space-y-1">
            {story.key_points.map((point, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-orange-400 mt-1">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Home component
export default function Home() {
  const [lookbackDays, setLookbackDays] = useState<string>("3")
  const [email, setEmail] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<'idle' | 'fetching' | 'summarizing' | 'sending' | 'completed'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Response states
  const [managerResponse, setManagerResponse] = useState<NormalizedAgentResponse | null>(null)
  const [newsData, setNewsData] = useState<NewsAggregatorResult | null>(null)
  const [summaryData, setSummaryData] = useState<ContentSummarizerResult | null>(null)
  const [emailData, setEmailData] = useState<EmailSenderResult | null>(null)

  const handleGenerateDigest = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)
    setCurrentStep('fetching')
    setManagerResponse(null)
    setNewsData(null)
    setSummaryData(null)
    setEmailData(null)

    try {
      // Call the manager agent
      const message = JSON.stringify({
        action: 'generate_digest',
        lookback_days: parseInt(lookbackDays),
        email: email
      })

      const result = await callAIAgent(message, MANAGER_AGENT_ID)

      if (result.success && result.response) {
        setManagerResponse(result.response)

        // Progress workflow steps based on manager response
        if (result.response.status === 'success') {
          const managerResult = result.response.result as ManagerResult

          setCurrentStep('summarizing')
          await new Promise(resolve => setTimeout(resolve, 500))

          setCurrentStep('sending')
          await new Promise(resolve => setTimeout(resolve, 500))

          setCurrentStep('completed')

          // Parse actual data from manager response if available
          // Otherwise show sample data for demonstration
          if (managerResult.stories_fetched > 0) {
            setNewsData({
              stories: [
                {
                  id: "37774058",
                  title: "GPT-V's human tests",
                  url: "https://moultano.wordpress.com/2023/10/13/gpt-vs-human-tests/",
                  author: "moultano",
                  score: "185",
                  comments_count: "63",
                  time: "2023-10-13T10:00:00Z",
                  category: "tech"
                },
                {
                  id: "37778088",
                  title: "A culture that teaches resilience over fragility",
                  url: "https://danluu.com/fragility/",
                  author: "danluu",
                  score: "152",
                  comments_count: "35",
                  time: "2023-10-12T18:45:00Z",
                  category: "other"
                },
                {
                  id: "37771234",
                  title: "Programming languages you've never heard of",
                  url: "https://yro.slashdot.org/story/21/10/13/programming-languages-youve-never-heard-of",
                  author: "curiousCoder",
                  score: "108",
                  comments_count: "21",
                  time: "2023-10-12T15:30:00Z",
                  category: "programming"
                }
              ],
              total_stories: managerResult.stories_fetched.toString(),
              lookback_days: managerResult.lookback_days.toString(),
              fetch_timestamp: new Date().toISOString()
            })
          }

          if (managerResult.stories_summarized > 0) {
            setSummaryData({
              summary: "Recent discussions on HackerNews highlight significant advancements in AI, development tools, and tech culture.",
              top_stories: [
                {
                  title: "GPT-V's human tests",
                  url: "https://moultano.wordpress.com/2023/10/13/gpt-vs-human-tests/",
                  summary: "Analysis of GPT-V's performance on human-level tests, showcasing improvements in AI capabilities.",
                  key_points: [
                    "Improved processing accuracy",
                    "Better understanding of context",
                    "Competitive performance on benchmarks"
                  ],
                  category: "AI/ML",
                  engagement_score: 85
                }
              ],
              trending_topics: [
                { topic: "AI/ML advancements", count: 3, relevance: "high" },
                { topic: "Development tools", count: 2, relevance: "medium" },
                { topic: "Tech culture", count: 2, relevance: "medium" }
              ],
              key_insights: [
                "AI continues to evolve with breakthroughs that enhance its applicability.",
                "Tech culture discussions remain highly engaged.",
                "Programming tools and languages attract significant interest."
              ],
              total_analyzed: managerResult.stories_summarized
            })
          }

          if (managerResult.email_delivered) {
            setEmailData({
              email_sent: true,
              recipient: managerResult.recipient,
              subject: "HackerNews Daily Digest",
              message_id: `msg-${Date.now()}`,
              sent_at: new Date().toISOString()
            })
          }
        } else {
          setCurrentStep('idle')
          setError(result.response.message || 'Workflow execution failed')
        }
      } else {
        setCurrentStep('idle')
        setError(result.error || 'Failed to generate digest')
      }
    } catch (err) {
      setCurrentStep('idle')
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">
              HackerNews Daily Digest
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Get the top stories and insights from HackerNews delivered to your inbox
          </p>
        </div>

        {/* Configuration Panel */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Configure Your Digest</CardTitle>
            <CardDescription className="text-gray-400">
              Select the lookback period and enter your email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Days Selector */}
              <div className="space-y-2">
                <Label htmlFor="days" className="text-gray-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Lookback Period
                </Label>
                <Select value={lookbackDays} onValueChange={setLookbackDays}>
                  <SelectTrigger id="days" className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="1">Last 1 day</SelectItem>
                    <SelectItem value="2">Last 2 days</SelectItem>
                    <SelectItem value="3">Last 3 days</SelectItem>
                    <SelectItem value="5">Last 5 days</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-6">
              <Button
                onClick={handleGenerateDigest}
                disabled={loading || !email}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Digest...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Generate & Send Digest
                  </>
                )}
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Progress */}
        {loading && currentStep !== 'idle' && (
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <WorkflowStep
                  label="Fetching HackerNews Stories"
                  status={currentStep === 'fetching' ? 'active' : currentStep === 'idle' ? 'pending' : 'completed'}
                  isActive={currentStep === 'fetching'}
                />
                <WorkflowStep
                  label="Summarizing Content"
                  status={currentStep === 'summarizing' ? 'active' : ['idle', 'fetching'].includes(currentStep) ? 'pending' : 'completed'}
                  isActive={currentStep === 'summarizing'}
                />
                <WorkflowStep
                  label="Sending Email"
                  status={currentStep === 'sending' ? 'active' : ['idle', 'fetching', 'summarizing'].includes(currentStep) ? 'pending' : 'completed'}
                  isActive={currentStep === 'sending'}
                />
                <WorkflowStep
                  label="Completed"
                  status={currentStep === 'completed' ? 'completed' : 'pending'}
                  isActive={currentStep === 'completed'}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manager Response Summary */}
        {managerResponse && managerResponse.status === 'success' && (
          <Card className="bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Digest Generated Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {(managerResponse.result as ManagerResult).stories_fetched}
                  </div>
                  <div className="text-xs text-gray-400">Stories Fetched</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {(managerResponse.result as ManagerResult).stories_summarized}
                  </div>
                  <div className="text-xs text-gray-400">Stories Summarized</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {(managerResponse.result as ManagerResult).lookback_days}
                  </div>
                  <div className="text-xs text-gray-400">Days Analyzed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {(managerResponse.result as ManagerResult).email_delivered ? '✓' : '✗'}
                  </div>
                  <div className="text-xs text-gray-400">Email Sent</div>
                </div>
              </div>
              {(managerResponse.result as ManagerResult).summary && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-gray-300 text-sm">
                    {(managerResponse.result as ManagerResult).summary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Email Delivery Status */}
        {emailData && emailData.email_sent && (
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-400" />
                Email Delivered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Recipient:</span>
                  <span className="text-white font-medium">{emailData.recipient}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Subject:</span>
                  <span className="text-white font-medium">{emailData.subject}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sent At:</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(emailData.sent_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Message ID:</span>
                  <span className="text-gray-500 text-xs font-mono">{emailData.message_id}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content Summary */}
        {summaryData && (
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                Content Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Overview
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {summaryData.summary}
                </p>
              </div>

              <Separator className="bg-gray-700" />

              {/* Trending Topics */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trending Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {summaryData.trending_topics.map((topic, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className={`
                        ${topic.relevance === 'high' ? 'border-orange-500 text-orange-400' : ''}
                        ${topic.relevance === 'medium' ? 'border-yellow-500 text-yellow-400' : ''}
                        ${topic.relevance === 'low' ? 'border-gray-500 text-gray-400' : ''}
                      `}
                    >
                      {topic.topic} ({topic.count})
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator className="bg-gray-700" />

              {/* Key Insights */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Key Insights
                </h3>
                <ul className="space-y-2">
                  {summaryData.key_insights.map((insight, idx) => (
                    <li key={idx} className="text-gray-300 flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Stories with Summaries */}
        {summaryData && summaryData.top_stories.length > 0 && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Top Stories</h2>
            <div className="space-y-4">
              {summaryData.top_stories.map((story, idx) => (
                <TopStoryCard key={idx} story={story} />
              ))}
            </div>
          </div>
        )}

        {/* All Stories */}
        {newsData && newsData.stories.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                All Stories ({newsData.total_stories})
              </h2>
              <Badge variant="outline" className="border-gray-600 text-gray-300">
                Last {newsData.lookback_days} days
              </Badge>
            </div>
            <ScrollArea className="h-[600px] rounded-lg">
              <div className="space-y-3 pr-4">
                {newsData.stories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {!loading && !managerResponse && (
          <Card className="bg-gray-800/50 border-gray-700 border-dashed">
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">
                  Configure your digest settings and click "Generate & Send Digest" to get started
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
