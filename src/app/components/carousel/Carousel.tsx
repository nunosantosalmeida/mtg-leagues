import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel } from "@mantine/carousel";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import styles from "./Carousel.module.css";

export function CarouselComponent() {
  return (
    <Carousel
      className={styles.carousel}
      withIndicators={false}
      withControls
      controlsOffset="lg"
      controlSize={26}
      nextControlIcon={<ArrowRightIcon size={16} />}
      previousControlIcon={<ArrowLeftIcon size={16} />}
      emblaOptions={{
        loop: true,
        duration: 16,
        slidesToScroll: 1,
      }}
    >
      <Carousel.Slide className={styles.slide1}>
        <div className="h-full text-center align flex flex-col justify-center items-center">
          <h1 className="text-5xl font-bold tracking-tight mb-3 text-gray-100">MTG Leagues</h1>
          <p className="text-lg max-w-xl mx-auto">
            Track your Magic: The Gathering league standings, results, and rankings
          </p>
        </div>
      </Carousel.Slide>
      <Carousel.Slide>
        <Card className="border-dashed mb-10">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-center">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold mb-3">
                  1
                </div>
                <h3 className="font-medium text-sm mb-1">Create or Join</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Join leagues during registration period, or check with an admin if you can still
                  join after it started
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold mb-3">
                  2
                </div>
                <h3 className="font-medium text-sm mb-1">Play Rounds</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Compete every week. 7% of points are at stake each round! :)
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold mb-3">
                  3
                </div>
                <h3 className="font-medium text-sm mb-1">Climb the Rankings</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Win games to earn points. Top cut qualifies for the final showdown!!!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Carousel.Slide>
      <Carousel.Slide>
        <Card className="border-dashed mb-10">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-center">Get Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ready to dive in? Join a league today and give it a try!
            </p>
          </CardContent>
        </Card>
      </Carousel.Slide>
    </Carousel>
  );
}
