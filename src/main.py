# import discord
from secrets.secrets import DISCORD_BOT_TOKEN
import query.api





class MyClient(discord.Client):
    async def on_ready(self):
        print(f'Logged on as {self.user}!')

    async def on_message(self, message):
        print(f'Message from {message.author}: {message.content}')


def start_bot():
    intents = discord.Intents.default()
    intents.message_content = True

    client = MyClient(intents=intents)
    client.run(DISCORD_BOT_TOKEN)

    

if __name__ == "__main__":
    start_bot()

