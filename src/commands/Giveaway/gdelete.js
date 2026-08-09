import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { saveGiveaway } from '../../utils/giveaways.js';
import { 
    parseDuration, 
    validatePrize, 
    validateWinnerCount,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import { botConfig } from '../../config/bot.js';

const GIVEAWAY_MIN_WINNERS = botConfig.giveaways?.minimumWinners ?? 1;
const GIVEAWAY_MAX_WINNERS = botConfig.giveaways?.maximumWinners ?? 10;

export default {
    data: new SlashCommandBuilder()
        .setName("cekilis-baslat")
        .setDescription("Belirtilen kanalda yeni bir çekiliş başlatır.")
        .addStringOption((option) =>
            option
                .setName("sure")
                .setDescription(
                    "Çekilişin ne kadar süreceği (örn. 1h, 30m, 5d).",
                )
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("kazanan-sayisi")
                .setDescription("Seçilecek kazanan sayısı.")
                .setMinValue(GIVEAWAY_MIN_WINNERS)
                .setMaxValue(GIVEAWAY_MAX_WINNERS)
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("odul")
                .setDescription("Çekilişte verilecek ödül.")
                .setRequired(true),
        )
        .addChannelOption((option) =>
            option
                .setName("kanal")
                .setDescription("Çekilişin gönderileceği kanal (varsayılan olarak bulunduğu kanal).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Önceden ertele: Çekiliş mesajını gönderme + DB yazma işlemi 3 saniyelik süreyi aşabilir
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway command used outside guild',
                ErrorTypes.VALIDATION,
                'Bu komut yalnızca bir sunucuda kullanılabilir.',
                { userId: interaction.user.id }
            );
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "Bir çekiliş başlatmak için 'Sunucuyu Yönet' yetkisine ihtiyacınız var.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Çekiliş başlatma isteği ${interaction.user.tag} tarafından ${interaction.guildId} sunucusunda başlatıldı.`);

        const durationString = interaction.options.getString("sure");
        const winnerCount = interaction.options.getInteger("kazanan-sayisi");
        const prize = interaction.options.getString("odul");
        const targetChannel = interaction.options.getChannel("kanal") || interaction.channel;

        const durationMs = parseDuration(durationString);
        validateWinnerCount(winnerCount);
        const prizeName = validatePrize(prize);

        if (!targetChannel.isTextBased()) {
            throw new TitanBotError(
                'Target channel is not text-based',
                ErrorTypes.VALIDATION,
                'Hedef kanal bir metin kanalı olmalıdır.',
                { channelId: targetChannel.id, channelType: targetChannel.type }
            );
        }

        const endTime = Date.now() + durationMs;

        const initialGiveawayData = {
            messageId: "placeholder",
            channelId: targetChannel.id,
            guildId: interaction.guildId,
            prize: prizeName,
            hostId: interaction.user.id,
            endTime: endTime,
            endsAt: endTime,
            winnerCount: winnerCount,
            participants: [],
            isEnded: false,
            ended: false,
            createdAt: new Date().toISOString()
        };

        const embed = createGiveawayEmbed(initialGiveawayData, "active");
        const row = createGiveawayButtons(false);

        const giveawayMessage = await targetChannel.send({
            content: "🎉 **YENİ ÇEKİLİŞ** 🎉",
            embeds: [embed],
            components: [row],
        });

        initialGiveawayData.messageId = giveawayMessage.id;
        const saved = await saveGiveaway(
            interaction.client,
            interaction.guildId,
            initialGiveawayData,
        );

        if (!saved) {
            logger.warn(`Çekiliş veritabanına kaydedilemedi: ${giveawayMessage.id}`);
        }

        try {
            await logEvent({
                client: interaction.client,
                guildId: interaction.guildId,
                eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                data: {
                    description: `Çekiliş oluşturuldu: ${prizeName}`,
                    channelId: targetChannel.id,
                    userId: interaction.user.id,
                    fields: [
                        {
                            name: 'Ödül',
                            value: prizeName,
                            inline: true
                        },
                        {
                            name: 'Kazananlar',
                            value: winnerCount.toString(),
                            inline: true
                        },
                        {
                            name: 'Süre',
                            value: durationString,
                            inline: true
                        },
                        {
                            name: 'Kanal',
                            value: targetChannel.toString(),
                            inline: true
                        }
                    ]
                }
            });
        } catch (logError) {
            logger.debug('Çekiliş oluşturma olayı loglanırken hata oluştu:', logError);
        }

        logger.info(`Çekiliş başarıyla oluşturuldu: ${giveawayMessage.id} - Kanal: ${targetChannel.name}`);

        await InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    `Çekiliş Başlatıldı! 🎉`,
                    `**${prizeName}** için yeni bir çekiliş ${targetChannel} kanalında başlatıldı ve **${durationString}** sonra sona erecek.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};